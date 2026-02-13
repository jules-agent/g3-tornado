/**
 * Capitalize the first letter of a string.
 * Returns the original string if empty or not a string.
 */
export function capitalizeFirst(str: string | null | undefined): string {
  if (!str) return str ?? "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Get company flags from an owner/contact record.
 * Returns {up, bp, upfit} boolean flags.
 */
export function getCompanyFlags(owner: {
  is_up_employee?: boolean;
  is_bp_employee?: boolean;
  is_upfit_employee?: boolean;
  is_bpas_employee?: boolean;
  is_third_party_vendor?: boolean;
} | null | undefined): { up: boolean; bp: boolean; upfit: boolean; bpas: boolean } {
  if (!owner) return { up: false, bp: false, upfit: false, bpas: false };
  return {
    up: !!owner.is_up_employee,
    bp: !!owner.is_bp_employee,
    upfit: !!owner.is_upfit_employee,
    bpas: !!owner.is_bpas_employee,
  };
}

/**
 * Filter contacts/owners by project's company flags.
 * Returns only contacts that match at least one of the project's company flags.
 * Both employees AND vendors must have matching company flags.
 * Admins see all contacts.
 */
export function filterContactsByProject<T extends {
  is_up_employee?: boolean;
  is_bp_employee?: boolean;
  is_upfit_employee?: boolean;
  is_bpas_employee?: boolean;
  is_third_party_vendor?: boolean;
}>(
  contacts: T[],
  project: { is_up?: boolean; is_bp?: boolean; is_upfit?: boolean; is_bpas?: boolean } | null | undefined,
  isAdmin = false
): T[] {
  if (isAdmin) return contacts;
  if (!project) return contacts;
  
  const hasAnyFlag = project.is_up || project.is_bp || project.is_upfit || project.is_bpas;
  if (!hasAnyFlag) return contacts;

  return contacts.filter((contact) => {
    // Use company flags for ALL contacts (employees AND vendors)
    const contactFlags = getCompanyFlags(contact);
    
    // Contacts with no flags set are hidden (they need company association)
    if (!contactFlags.up && !contactFlags.bp && !contactFlags.upfit && !contactFlags.bpas) return false;
    
    // Match at least one company flag
    if (project.is_up && contactFlags.up) return true;
    if (project.is_bp && contactFlags.bp) return true;
    if (project.is_upfit && contactFlags.upfit) return true;
    if (project.is_bpas && contactFlags.bpas) return true;
    
    return false;
  });
}

/**
 * Filter projects by user's company flags.
 * Returns only projects the user has access to based on their owner record.
 * Admins see all projects.
 */
export function filterProjectsByUser<T extends {
  is_up?: boolean;
  is_bp?: boolean;
  is_upfit?: boolean;
  is_bpas?: boolean;
}>(
  projects: T[],
  userOwner: {
    is_up_employee?: boolean;
    is_bp_employee?: boolean;
    is_upfit_employee?: boolean;
    is_bpas_employee?: boolean;
    is_third_party_vendor?: boolean;
  } | null | undefined,
  isAdmin = false
): T[] {
  if (isAdmin) return projects;
  if (!userOwner) return [];

  const userFlags = getCompanyFlags(userOwner);
  
  return projects.filter((project) => {
    // Projects with no flags are visible to everyone
    if (!project.is_up && !project.is_bp && !project.is_upfit && !project.is_bpas) return true;
    
    // Match at least one company flag
    if (project.is_up && userFlags.up) return true;
    if (project.is_bp && userFlags.bp) return true;
    if (project.is_upfit && userFlags.upfit) return true;
    if (project.is_bpas && userFlags.bpas) return true;
    
    return false;
  });
}

/**
 * Derive the contact type from database flags.
 * Personal = is_private + no company flags + not vendor
 */
export function deriveContactType(contact: {
  is_up_employee?: boolean | null;
  is_bp_employee?: boolean | null;
  is_upfit_employee?: boolean | null;
  is_bpas_employee?: boolean | null;
  is_third_party_vendor?: boolean | null;
  is_private?: boolean | null;
}): { isEmployee: boolean; isVendor: boolean; isPersonal: boolean } {
  const hasCompany = !!(contact.is_up_employee || contact.is_bp_employee || contact.is_upfit_employee || contact.is_bpas_employee);
  const isVendor = !!contact.is_third_party_vendor;
  const isPrivate = !!contact.is_private;
  
  // Personal = private + no company flags + not vendor
  const isPersonal = isPrivate && !hasCompany && !isVendor;
  // Employee = has any company flag and is not ONLY a vendor
  const isEmployee = hasCompany && !isPersonal;
  
  return { isEmployee, isVendor, isPersonal };
}

/**
 * Validate contact associations according to business rules.
 * 
 * Contact Type Model:
 * - Employee: works at companies, MUST have at least one company (UP/BP/UPFIT/BPAS)
 * - Vendor: external vendor, MUST have at least one company (UP/BP/UPFIT/BPAS)  
 * - Personal: private to creator, NO company associations needed
 * - Employee + Vendor can coexist. Personal is mutually exclusive with Employee/Vendor.
 * - Any type can be marked Private. Personal is ALWAYS private.
 */
export function validateContactAssociations(contact: {
  is_up?: boolean;
  is_bp?: boolean;
  is_upfit_employee?: boolean;
  is_bpas_employee?: boolean;
  is_third_party_vendor?: boolean;
  is_private?: boolean;
  contactType?: 'employee' | 'vendor' | 'personal' | null;
}): { valid: boolean; error?: string } {
  const hasCompany = contact.is_up || contact.is_bp || contact.is_upfit_employee || contact.is_bpas_employee;
  const isVendor = contact.is_third_party_vendor;
  const contactType = contact.contactType;

  // If using the new type system
  if (contactType) {
    if (contactType === 'personal') {
      // Personal contacts don't need company associations
      return { valid: true };
    }
    
    if (contactType === 'employee' || contactType === 'vendor') {
      if (!hasCompany) {
        return {
          valid: false,
          error: `${contactType === 'employee' ? 'Employee' : 'Vendor'} contacts must have at least one company association (UP, BP, UPFIT, or BPAS)`
        };
      }
      return { valid: true };
    }
    
    return { valid: false, error: "Please select a contact type (Employee, Vendor, or Personal)" };
  }

  // Legacy validation (no contactType passed) — derive type from flags
  const isPrivate = contact.is_private;
  const isPersonal = isPrivate && !hasCompany && !isVendor;
  
  if (isPersonal) {
    return { valid: true };
  }
  
  // Employee or Vendor must have company
  if (isVendor && !hasCompany) {
    return { 
      valid: false, 
      error: "Vendor contacts must have at least one company association (UP, BP, UPFIT, or BPAS)" 
    };
  }
  
  if (!hasCompany && !isVendor && !isPrivate) {
    return { 
      valid: false, 
      error: "Contact must have at least one association. Select a type: Employee, Vendor, or Personal." 
    };
  }
  
  return { valid: true };
}

/**
 * Check if a contact has no associations (for sorting/highlighting).
 */
export function hasNoAssociations(contact: {
  is_up?: boolean;
  is_bp?: boolean;
  is_upfit_employee?: boolean;
  is_bpas_employee?: boolean;
  is_third_party_vendor?: boolean;
  is_private?: boolean;
}): boolean {
  const hasCompany = contact.is_up || contact.is_bp || contact.is_upfit_employee || contact.is_bpas_employee;
  const isVendor = contact.is_third_party_vendor;
  const isPrivate = contact.is_private;
  return !hasCompany && !isVendor && !isPrivate;
}
