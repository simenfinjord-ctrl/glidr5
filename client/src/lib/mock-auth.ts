export type GroupScope = "Admin" | "World Cup" | "U23" | "Biathlon";

export type MockUser = {
  id: string;
  email: string;
  name: string;
  groupScope: GroupScope;
  isAdmin: boolean;
};

const STORAGE_KEY = "fastski.mock.user";

export const seedUsers: MockUser[] = [
  {
    id: "user-admin-1",
    email: "admin@fastski.local",
    name: "Admin",
    groupScope: "Admin",
    isAdmin: true,
  },
  {
    id: "user-u23-1",
    email: "u23@fastski.local",
    name: "U23 Coach",
    groupScope: "U23",
    isAdmin: false,
  },
];

export function getCurrentUser(): MockUser | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MockUser;
  } catch {
    return null;
  }
}

export function login(email: string, password: string): MockUser | null {
  // mock-only auth: any password works if email matches a seeded user
  void password;
  const user = seedUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return null;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  return user;
}

export function logout() {
  localStorage.removeItem(STORAGE_KEY);
}
