create index organization_operating_settings_updated_by_idx
  on public.organization_operating_settings(updated_by);
create index forecast_calculations_sku_org_idx
  on public.forecast_calculations(sku_id, organization_id);
create index forecast_calculations_location_org_idx
  on public.forecast_calculations(location_id, organization_id);
create index issues_forecast_org_idx
  on public.issues(forecast_calculation_id, organization_id);
create index issues_assigned_to_idx
  on public.issues(assigned_to);
create index issue_recommendations_issue_org_idx
  on public.issue_recommendations(issue_id, organization_id);
create index issue_recommendations_source_location_org_idx
  on public.issue_recommendations(source_location_id, organization_id);
create index issue_recommendations_destination_location_org_idx
  on public.issue_recommendations(destination_location_id, organization_id);
create index actions_requested_by_idx
  on public.actions(requested_by);
create index actions_approved_by_idx
  on public.actions(approved_by);
create index action_outcomes_action_org_idx
  on public.action_outcomes(action_id, organization_id);
