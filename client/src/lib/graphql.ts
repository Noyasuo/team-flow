import { gql } from '@apollo/client';

export const LOGIN = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      token
      user {
        id
        name
        username
        email
        title
        role
      }
    }
  }
`;

export const ME = gql`
  query Me {
    me {
      id
      name
      username
      email
      title
    }
  }
`;

export const WORKSPACES = gql`
  query Workspaces {
    workspaces {
      id
      name
      description
      owner {
        id
      }
      members {
        role
        user {
          id
          name
          email
        }
      }
    }
  }
`;

export const CREATE_WORKSPACE = gql`
  mutation CreateWorkspace($input: CreateWorkspaceInput!) {
    createWorkspace(input: $input) {
      id
      name
      description
    }
  }
`;

export const USERS = gql`
  query Users($page: Int, $limit: Int) {
    users(page: $page, limit: $limit) {
      nodes {
        id
        name
        email
      }
      pageInfo {
        page
        totalPages
        totalCount
      }
    }
  }
`;

export const ADD_WORKSPACE_MEMBER = gql`
  mutation AddWorkspaceMember($input: AddWorkspaceMemberInput!) {
    addWorkspaceMember(input: $input) {
      id
      members {
        role
        user {
          id
          name
          email
        }
      }
    }
  }
`;

export const WORKSPACE = gql`
  query Workspace($id: ID!) {
    workspace(id: $id) {
      id
      name
      description
      members {
        role
        user {
          id
          name
          email
        }
      }
    }
  }
`;

export const DASHBOARD = gql`
  query Dashboard($workspaceId: ID!) {
    dashboard(workspaceId: $workspaceId) {
      totalProjects
      totalTasks
      overdueTasks
      completedTasksThisWeek
      tasksByStatus {
        key
        count
      }
      tasksByPriority {
        key
        count
      }
    }
  }
`;

export const ADMIN_STATS = gql`
  query AdminStats {
    adminStats {
      totalUsers
      activeUsers
      totalWorkspaces
      totalProjects
      totalTasks
      openTasks
      completedTasks
    }
  }
`;

export const ADMIN_OPERATIONS = gql`
  query AdminOperations {
    adminUsers { id username name email role isActive createdAt }
    adminWorkspaces { id name description owner { name email } members { user { id } role } createdAt }
    adminProjects { id name status workspace { name } createdBy { name } dueDate createdAt }
    adminTasks { id title status priority project { name } assignee { name } createdAt }
  }
`;

export const CREATE_ADMIN_USER = gql`
  mutation CreateAdminUser($input: CreateAdminUserInput!) {
    createAdminUser(input: $input) { id username name email role isActive createdAt }
  }
`;

export const SET_USER_ACTIVE = gql`
  mutation SetUserActive($userId: ID!, $isActive: Boolean!) {
    setUserActive(userId: $userId, isActive: $isActive) { id isActive }
  }
`;

export const SET_ADMIN_TASK_STATUS = gql`
  mutation SetAdminTaskStatus($taskId: ID!, $status: TaskStatus!) {
    setAdminTaskStatus(taskId: $taskId, status: $status) { id status }
  }
`;

export const PROJECTS = gql`
  query Projects($workspaceId: ID!, $page: Int, $limit: Int) {
    projects(workspaceId: $workspaceId, page: $page, limit: $limit) {
      nodes {
        id
        name
        status
        dueDate
      }
      pageInfo {
        page
        totalPages
        totalCount
      }
    }
  }
`;

export const PROJECT = gql`
  query Project($id: ID!) {
    project(id: $id) {
      id
      name
      description
      status
      workspace {
        id
        name
      }
    }
  }
`;

export const CREATE_PROJECT = gql`
  mutation CreateProject($input: CreateProjectInput!) {
    createProject(input: $input) {
      id
      name
      description
      status
      workspace {
        id
      }
    }
  }
`;

export const TASKS = gql`
  query Tasks(
    $projectId: ID!
    $page: Int
    $limit: Int
    $status: TaskStatus
    $priority: TaskPriority
    $search: String
  ) {
    tasks(
      projectId: $projectId
      page: $page
      limit: $limit
      status: $status
      priority: $priority
      search: $search
    ) {
      nodes {
        id
        title
        status
        priority
        dueDate
        description
        assignee {
          id
          name
        }
      }
      pageInfo {
        page
        totalPages
        totalCount
      }
    }
  }
`;

export const TASK = gql`
  query Task($id: ID!) {
    task(id: $id) {
      id
      title
      description
      status
      priority
      dueDate
      assignee {
        id
        name
      }
      project {
        id
        name
      }
      comments {
        nodes {
          id
          body
          createdAt
          author {
            id
            name
          }
        }
      }
    }
  }
`;

export const CREATE_TASK = gql`
  mutation CreateTask($input: CreateTaskInput!) {
    createTask(input: $input) {
      id
      title
      status
      priority
    }
  }
`;

export const UPDATE_TASK = gql`
  mutation UpdateTask($input: UpdateTaskInput!) {
    updateTask(input: $input) {
      id
      title
      status
      priority
      dueDate
      assignee {
        id
        name
      }
    }
  }
`;

export const ADD_COMMENT = gql`
  mutation AddComment($input: AddCommentInput!) {
    addComment(input: $input) {
      id
      body
      createdAt
      author {
        id
        name
      }
    }
  }
`;
