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
  is_third_party_vendor?: boolean;
} | null | undefined): { up: boolean; bp: boolean; upfit: boolean } {
  if (!owner) return { up: false, bp: false, upfit: false };
  return {
    up: !!owner.is_up_employee,
    bp: !!owner.is_bp_employee,
    upfit: !!owner.is_upfit_employee,
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
  is_third_party_vendor?: boolean;
}>(
  contacts: T[],
  project: { is_up?: boolean; is_bp?: boolean; is_upfit?: boolean } | null | undefined,
  isAdmin = false
): T[] {
  if (isAdmin) return contacts;
  if (!project) return contacts;
  
  const hasAnyFlag = project.is_up || project.is_bp || project.is_upfit;
  if (!hasAnyFlag) return contacts;

  return contacts.filter((contact) => {
    // Use company flags for ALL contacts (employees AND vendors)
    const contactFlags = getCompanyFlags(contact);
    
    // Contacts with no flags set are hidden (they need company association)
    if (!contactFlags.up && !contactFlags.bp && !contactFlags.upfit) return false;
    
    // Match at least one company flag
    if (project.is_up && contactFlags.up) return true;
    if (project.is_bp && contactFlags.bp) return true;
    if (project.is_upfit && contactFlags.upfit) return true;
    
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
}>(
  projects: T[],
  userOwner: {
    is_up_employee?: boolean;
    is_bp_employee?: boolean;
    is_upfit_employee?: boolean;
    is_third_party_vendor?: boolean;
  } | null | undefined,
  isAdmin = false
): T[] {
  if (isAdmin) return projects;
  if (!userOwner) return [];

  const userFlags = getCompanyFlags(userOwner);
  
  return projects.filter((project) => {
    // Projects with no flags are visible to everyone
    if (!project.is_up && !project.is_bp && !project.is_upfit) return true;
    
    // Match at least one company flag
    if (project.is_up && userFlags.up) return true;
    if (project.is_bp && userFlags.bp) return true;
    if (project.is_upfit && userFlags.upfit) return true;
    
    return false;
  });
}
