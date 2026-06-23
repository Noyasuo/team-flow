const TEAM_ROLES = ['ADMIN', 'MANAGER', 'MEMBER', 'CLIENT'];

function assertRole(context, allowedRoles) {
  const role = context.role || context.userRole || context.user?.role || null;

  if (!role) {
    throw new Error('Role information is missing from the request context');
  }

  if (!allowedRoles.includes(role)) {
    throw new Error('You do not have permission for this action');
  }

  return role;
}

function hasAnyRole(role, allowedRoles) {
  return Boolean(role) && allowedRoles.includes(role);
}

module.exports = {
  TEAM_ROLES,
  assertRole,
  hasAnyRole,
};
