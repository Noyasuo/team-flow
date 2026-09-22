const { typeDefs } = require('./typeDefs');

describe('project access schema', () => {
  it('exposes only view and edit levels for project membership', () => {
    const projectAccessEnum = typeDefs.match(/enum ProjectAccessLevel \{[^}]+\}/)?.[0] ?? '';
    expect(projectAccessEnum).toBe('enum ProjectAccessLevel { VIEW EDIT }');
    expect(projectAccessEnum).not.toContain('MANAGE');
  });

  it('supports workspace, project and task update or delete mutations for admin management', () => {
    expect(typeDefs).toContain('updateWorkspace(input: UpdateWorkspaceInput!): Workspace!');
    expect(typeDefs).toContain('deleteWorkspace(id: ID!): Boolean!');
    expect(typeDefs).toContain('updateProject(input: UpdateProjectInput!): Project!');
    expect(typeDefs).toContain('deleteProject(id: ID!): Boolean!');
    expect(typeDefs).toContain('deleteTask(id: ID!): Boolean!');
  });
});
