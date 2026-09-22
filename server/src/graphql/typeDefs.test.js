const { typeDefs } = require('./typeDefs');

describe('project access schema', () => {
  it('exposes only view and edit levels for project membership', () => {
    const projectAccessEnum = typeDefs.match(/enum ProjectAccessLevel \{[^}]+\}/)?.[0] ?? '';
    expect(projectAccessEnum).toBe('enum ProjectAccessLevel { VIEW EDIT }');
    expect(projectAccessEnum).not.toContain('MANAGE');
  });
});
