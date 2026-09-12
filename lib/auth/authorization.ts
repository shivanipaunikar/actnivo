export type MembershipIdentity = {
  organizationId: string;
  userId: string;
};

export function canAccessOrganization(
  memberships: MembershipIdentity[],
  userId: string,
  organizationId: string,
) {
  return memberships.some(
    (membership) =>
      membership.userId === userId &&
      membership.organizationId === organizationId,
  );
}

export function protectedRouteDestination(input: {
  authenticated: boolean;
  hasOrganization: boolean;
  onboardingComplete: boolean;
}) {
  if (!input.authenticated) return "/login";
  if (!input.hasOrganization) return "/onboarding/company";
  if (!input.onboardingComplete) return "/onboarding/channels";
  return null;
}
