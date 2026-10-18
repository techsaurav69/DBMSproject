export const roles = ['citizen', 'coordinator', 'provider_operator', 'responder', 'administrator'] as const;
export type user_role_code = typeof roles[number];
