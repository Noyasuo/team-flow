const typeDefs = `#graphql
  scalar DateTime
  scalar JSON

  enum WorkspaceRole {
    ADMIN
    MANAGER
    MEMBER
    VIEWER
  }

  enum ProjectStatus {
    PLANNING
    ACTIVE
    ON_HOLD
    DONE
  }

  enum TaskStatus {
    TODO
    IN_PROGRESS
    REVIEW
    DONE
  }

  enum TaskPriority {
    LOW
    MEDIUM
    HIGH
    URGENT
  }

  enum NotificationKind {
    INFO
    TASK
    COMMENT
    ASSIGNMENT
  }

  type User {
    id: ID!
    name: String!
    email: String!
    role: WorkspaceRole!
    title: String
    avatarUrl: String
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type WorkspaceMember {
    user: User!
    role: WorkspaceRole!
  }

  type TeamMember {
    user: User!
    role: WorkspaceRole!
  }

  type Workspace {
    id: ID!
    name: String!
    description: String
    owner: User!
    members: [WorkspaceMember!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Team {
    id: ID!
    name: String!
    description: String
    owner: User!
    members: [TeamMember!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Project {
    id: ID!
    workspace: Workspace!
    name: String!
    description: String
    status: ProjectStatus!
    startDate: DateTime
    dueDate: DateTime
    createdBy: User!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Task {
    id: ID!
    workspace: Workspace!
    project: Project!
    title: String!
    description: String
    status: TaskStatus!
    priority: TaskPriority!
    dueDate: DateTime
    assignee: User
    createdBy: User!
    createdAt: DateTime!
    updatedAt: DateTime!
    comments(page: Int = 1, limit: Int = 10): CommentConnection!
  }

  type Comment {
    id: ID!
    workspace: Workspace!
    task: Task!
    author: User!
    body: String!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Activity {
    id: ID!
    workspace: Workspace!
    actor: User!
    entityType: String!
    entityId: ID!
    action: String!
    meta: JSON
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Notification {
    id: ID!
    user: User!
    workspace: Workspace!
    title: String!
    message: String!
    kind: NotificationKind!
    readAt: DateTime
    referenceType: String
    referenceId: ID
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type PageInfo {
    page: Int!
    limit: Int!
    totalCount: Int!
    totalPages: Int!
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
  }

  type UserConnection {
    nodes: [User!]!
    pageInfo: PageInfo!
  }

  type ProjectConnection {
    nodes: [Project!]!
    pageInfo: PageInfo!
  }

  type TaskConnection {
    nodes: [Task!]!
    pageInfo: PageInfo!
  }

  type CommentConnection {
    nodes: [Comment!]!
    pageInfo: PageInfo!
  }

  type ActivityConnection {
    nodes: [Activity!]!
    pageInfo: PageInfo!
  }

  type NotificationConnection {
    nodes: [Notification!]!
    pageInfo: PageInfo!
  }

  type KeyValueCount {
    key: String!
    count: Int!
  }

  type DashboardStats {
    totalProjects: Int!
    totalTasks: Int!
    overdueTasks: Int!
    tasksByStatus: [KeyValueCount!]!
    tasksByPriority: [KeyValueCount!]!
    completedTasksThisWeek: Int!
  }

  input RegisterInput {
    name: String!
    email: String!
    password: String!
    title: String
  }

  input LoginInput {
    email: String!
    password: String!
  }

  input CreateWorkspaceInput {
    name: String!
    description: String
  }

  input AddWorkspaceMemberInput {
    workspaceId: ID!
    userId: ID!
    role: WorkspaceRole!
  }

  input CreateProjectInput {
    workspaceId: ID!
    name: String!
    description: String
    status: ProjectStatus = ACTIVE
    startDate: DateTime
    dueDate: DateTime
  }

  input CreateTaskInput {
    workspaceId: ID!
    projectId: ID!
    title: String!
    description: String
    priority: TaskPriority = MEDIUM
    status: TaskStatus = TODO
    dueDate: DateTime
    assigneeId: ID
  }

  input UpdateTaskInput {
    id: ID!
    title: String
    description: String
    status: TaskStatus
    priority: TaskPriority
    dueDate: DateTime
    assigneeId: ID
  }

  input AddCommentInput {
    taskId: ID!
    body: String!
  }

  type Query {
    me: User
    users(page: Int = 1, limit: Int = 10): UserConnection!

    workspaces: [Workspace!]!
    workspace(id: ID!): Workspace
    teams: [Team!]!
    team(id: ID!): Team

    projects(workspaceId: ID!, page: Int = 1, limit: Int = 10): ProjectConnection!
    project(id: ID!): Project

    tasks(
      projectId: ID!
      page: Int = 1
      limit: Int = 10
      status: TaskStatus
      priority: TaskPriority
      search: String
      assigneeId: ID
    ): TaskConnection!
    task(id: ID!): Task

    activityFeed(workspaceId: ID!, page: Int = 1, limit: Int = 20): ActivityConnection!
    notifications(unreadOnly: Boolean = false, page: Int = 1, limit: Int = 20): NotificationConnection!
    dashboard(workspaceId: ID!): DashboardStats!
  }

  type Mutation {
    signup(input: RegisterInput!): AuthPayload!
    register(input: RegisterInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!

    createWorkspace(input: CreateWorkspaceInput!): Workspace!
    addWorkspaceMember(input: AddWorkspaceMemberInput!): Workspace!
    createTeam(input: CreateWorkspaceInput!): Team!
    inviteUser(input: AddWorkspaceMemberInput!): Team!

    createProject(input: CreateProjectInput!): Project!

    createTask(input: CreateTaskInput!): Task!
    updateTask(input: UpdateTaskInput!): Task!

    addComment(input: AddCommentInput!): Comment!

    markNotificationRead(notificationId: ID!): Notification!
    markAllNotificationsRead: Boolean!
  }
`;

module.exports = { typeDefs };
