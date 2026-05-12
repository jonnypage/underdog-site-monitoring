import { useMutation, useQuery } from "@apollo/client";
import type { QueryHookOptions, MutationHookOptions } from "@apollo/client";
import {
  AdminUsersDocument,
  AdminSitesDocument,
  AdminSensorCatalogListDocument,
  AdminDevicesDocument,
  AdminDeviceDocument,
  GetMeDocument,
  GetSitesDocument,
  GetSiteDocument,
  GetAlertsDocument,
  GetMeasurementsDocument,
  GetSensorMeasurementsDocument,
  CreateAdminUserDocument,
  UpdateAdminUserDocument,
  ResetAdminUserPasswordDocument,
  CreateAdminSiteDocument,
  UpdateAdminSiteDocument,
  CreateAdminDeviceDocument,
  UpdateAdminDeviceDocument,
  RotateAdminDeviceApiKeyDocument,
  DeleteAdminDeviceDocument,
  CreateSensorCatalogEntryDocument,
  UpdateSensorCatalogEntryDocument,
  DeleteSensorCatalogEntryDocument,
  ResolveAlertDocument,
  UpdateMeDocument,
} from "@/lib/gql/generated/graphql";
import type {
  AdminUsersQuery,
  AdminUsersQueryVariables,
  AdminSitesQuery,
  AdminSitesQueryVariables,
  AdminSensorCatalogListQuery,
  AdminSensorCatalogListQueryVariables,
  AdminDevicesQuery,
  AdminDevicesQueryVariables,
  AdminDeviceQuery,
  AdminDeviceQueryVariables,
  GetMeQuery,
  GetMeQueryVariables,
  GetSitesQuery,
  GetSitesQueryVariables,
  GetSiteQuery,
  GetSiteQueryVariables,
  GetAlertsQuery,
  GetAlertsQueryVariables,
  GetMeasurementsQuery,
  GetMeasurementsQueryVariables,
  GetSensorMeasurementsQuery,
  GetSensorMeasurementsQueryVariables,
  CreateAdminUserMutation,
  CreateAdminUserMutationVariables,
  UpdateAdminUserMutation,
  UpdateAdminUserMutationVariables,
  ResetAdminUserPasswordMutation,
  ResetAdminUserPasswordMutationVariables,
  CreateAdminSiteMutation,
  CreateAdminSiteMutationVariables,
  UpdateAdminSiteMutation,
  UpdateAdminSiteMutationVariables,
  CreateAdminDeviceMutation,
  CreateAdminDeviceMutationVariables,
  UpdateAdminDeviceMutation,
  UpdateAdminDeviceMutationVariables,
  RotateAdminDeviceApiKeyMutation,
  RotateAdminDeviceApiKeyMutationVariables,
  DeleteAdminDeviceMutation,
  DeleteAdminDeviceMutationVariables,
  CreateSensorCatalogEntryMutation,
  CreateSensorCatalogEntryMutationVariables,
  UpdateSensorCatalogEntryMutation,
  UpdateSensorCatalogEntryMutationVariables,
  DeleteSensorCatalogEntryMutation,
  DeleteSensorCatalogEntryMutationVariables,
  ResolveAlertMutation,
  ResolveAlertMutationVariables,
  UpdateMeMutation,
  UpdateMeMutationVariables,
} from "@/lib/gql/generated/graphql";

// ─── Query hooks ────────────────────────────────────────────────────────────

export function useAdminUsers(
  options?: QueryHookOptions<AdminUsersQuery, AdminUsersQueryVariables>
) {
  return useQuery(AdminUsersDocument, options);
}

export function useAdminSites(
  options?: QueryHookOptions<AdminSitesQuery, AdminSitesQueryVariables>
) {
  return useQuery(AdminSitesDocument, options);
}

export function useAdminSensorCatalogList(
  options?: QueryHookOptions<AdminSensorCatalogListQuery, AdminSensorCatalogListQueryVariables>
) {
  return useQuery(AdminSensorCatalogListDocument, options);
}

export function useAdminDevices(
  options?: QueryHookOptions<AdminDevicesQuery, AdminDevicesQueryVariables>
) {
  return useQuery(AdminDevicesDocument, options);
}

export function useAdminDevice(
  variables: AdminDeviceQueryVariables,
  options?: Omit<QueryHookOptions<AdminDeviceQuery, AdminDeviceQueryVariables>, "variables">
) {
  return useQuery(AdminDeviceDocument, { variables, ...options });
}

export function useGetMe(
  options?: QueryHookOptions<GetMeQuery, GetMeQueryVariables>
) {
  return useQuery(GetMeDocument, options);
}

export function useGetSites(
  options?: QueryHookOptions<GetSitesQuery, GetSitesQueryVariables>
) {
  return useQuery(GetSitesDocument, options);
}

export function useGetSite(
  variables: GetSiteQueryVariables,
  options?: Omit<QueryHookOptions<GetSiteQuery, GetSiteQueryVariables>, "variables">
) {
  return useQuery(GetSiteDocument, { variables, ...options });
}

export function useGetAlerts(
  variables: GetAlertsQueryVariables,
  options?: Omit<QueryHookOptions<GetAlertsQuery, GetAlertsQueryVariables>, "variables">
) {
  return useQuery(GetAlertsDocument, { variables, ...options });
}

export function useGetMeasurements(
  variables: GetMeasurementsQueryVariables,
  options?: Omit<QueryHookOptions<GetMeasurementsQuery, GetMeasurementsQueryVariables>, "variables">
) {
  return useQuery(GetMeasurementsDocument, { variables, ...options });
}

export function useGetSensorMeasurements(
  variables: GetSensorMeasurementsQueryVariables,
  options?: Omit<QueryHookOptions<GetSensorMeasurementsQuery, GetSensorMeasurementsQueryVariables>, "variables">
) {
  return useQuery(GetSensorMeasurementsDocument, { variables, ...options });
}

// ─── Mutation hooks ──────────────────────────────────────────────────────────

export function useCreateAdminUser(
  options?: MutationHookOptions<CreateAdminUserMutation, CreateAdminUserMutationVariables>
) {
  return useMutation(CreateAdminUserDocument, options);
}

export function useUpdateAdminUser(
  options?: MutationHookOptions<UpdateAdminUserMutation, UpdateAdminUserMutationVariables>
) {
  return useMutation(UpdateAdminUserDocument, options);
}

export function useResetAdminUserPassword(
  options?: MutationHookOptions<ResetAdminUserPasswordMutation, ResetAdminUserPasswordMutationVariables>
) {
  return useMutation(ResetAdminUserPasswordDocument, options);
}

export function useCreateAdminSite(
  options?: MutationHookOptions<CreateAdminSiteMutation, CreateAdminSiteMutationVariables>
) {
  return useMutation(CreateAdminSiteDocument, options);
}

export function useUpdateAdminSite(
  options?: MutationHookOptions<UpdateAdminSiteMutation, UpdateAdminSiteMutationVariables>
) {
  return useMutation(UpdateAdminSiteDocument, options);
}

export function useCreateAdminDevice(
  options?: MutationHookOptions<CreateAdminDeviceMutation, CreateAdminDeviceMutationVariables>
) {
  return useMutation(CreateAdminDeviceDocument, options);
}

export function useUpdateAdminDevice(
  options?: MutationHookOptions<UpdateAdminDeviceMutation, UpdateAdminDeviceMutationVariables>
) {
  return useMutation(UpdateAdminDeviceDocument, options);
}

export function useRotateAdminDeviceApiKey(
  options?: MutationHookOptions<RotateAdminDeviceApiKeyMutation, RotateAdminDeviceApiKeyMutationVariables>
) {
  return useMutation(RotateAdminDeviceApiKeyDocument, options);
}

export function useDeleteAdminDevice(
  options?: MutationHookOptions<DeleteAdminDeviceMutation, DeleteAdminDeviceMutationVariables>
) {
  return useMutation(DeleteAdminDeviceDocument, options);
}

export function useCreateSensorCatalogEntry(
  options?: MutationHookOptions<CreateSensorCatalogEntryMutation, CreateSensorCatalogEntryMutationVariables>
) {
  return useMutation(CreateSensorCatalogEntryDocument, options);
}

export function useUpdateSensorCatalogEntry(
  options?: MutationHookOptions<UpdateSensorCatalogEntryMutation, UpdateSensorCatalogEntryMutationVariables>
) {
  return useMutation(UpdateSensorCatalogEntryDocument, options);
}

export function useDeleteSensorCatalogEntry(
  options?: MutationHookOptions<DeleteSensorCatalogEntryMutation, DeleteSensorCatalogEntryMutationVariables>
) {
  return useMutation(DeleteSensorCatalogEntryDocument, options);
}

export function useResolveAlert(
  options?: MutationHookOptions<ResolveAlertMutation, ResolveAlertMutationVariables>
) {
  return useMutation(ResolveAlertDocument, options);
}

export function useUpdateMe(
  options?: MutationHookOptions<UpdateMeMutation, UpdateMeMutationVariables>
) {
  return useMutation(UpdateMeDocument, options);
}
