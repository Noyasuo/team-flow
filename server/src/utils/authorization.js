function assertAuthenticated(context) {
  if (!context.user) {
    throw new Error('Authentication required');
  }

  return context.user;
}

function getWorkspaceRole(workspace, userId) {
  const id = String(userId);

  if (String(workspace.owner) === id) {
    return 'ADMIN';
  }

  const member = workspace.members.find((entry) => String(entry.user) === id);
  return member ? member.role : null;
}

function assertWorkspaceAccess(workspace, userId) {
  const role = getWorkspaceRole(workspace, userId);
  if (!role) {
    throw new Error('You do not have access to this workspace');
  }
  return role;
}

function assertWorkspaceRole(workspace, userId, allowedRoles) {
  const role = assertWorkspaceAccess(workspace, userId);

  if (!allowedRoles.includes(role)) {
    throw new Error('You do not have permission for this action');
  }

  return role;
}

function getProjectAccessLevel(project, userId) {
  if (String(project.createdBy) === String(userId)) return 'EDIT';
  const member = (project.members || []).find((entry) => String(entry.user) === String(userId));
  return member ? member.accessLevel : null;
}

function assertProjectAccess(project, userId, minimumLevel) {
  const accessLevel = getProjectAccessLevel(project, userId);
  const levels = { VIEW: 0, EDIT: 1 };
  if (!accessLevel || levels[accessLevel] < levels[minimumLevel]) {
    throw new Error(`${minimumLevel} project access required`);
  }
  return accessLevel;
}

module.exports = {
  assertAuthenticated,
  getWorkspaceRole,
  assertWorkspaceAccess,
  assertWorkspaceRole,
  getProjectAccessLevel,
  assertProjectAccess,
};
