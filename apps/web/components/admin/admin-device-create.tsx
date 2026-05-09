"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { BOARDS } from "@/lib/firmware/boards";
import { apolloErrorMessage } from "@/lib/apollo-error-message";
import {
  AdminDevicesDocument,
  AdminSitesDocument,
  CreateAdminDeviceDocument
} from "@/lib/gql/generated/graphql";

function suggestDeviceId(siteName: string | undefined, hint: string) {
  const base = (siteName ?? "node").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${base || "node"}-${hint}`;
}

export function AdminDeviceCreate() {
  const router = useRouter();
  const { data: sitesData, loading: sitesLoading } = useQuery(AdminSitesDocument);
  const [createDevice, { loading: creating }] = useMutation(CreateAdminDeviceDocument);

  const sites = sitesData?.adminSites ?? [];
  const enabledBoards = BOARDS.filter((b) => !b.comingSoon);

  const [siteId, setSiteId] = useState("");
  const [name, setName] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [board, setBoard] = useState(enabledBoards[0]?.id ?? "");
  const [interval, setInterval] = useState(300);
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<{ deviceUuid: string; deviceId: string; apiKey: string } | null>(null);

  useEffect(() => {
    if (!siteId && sites.length > 0) {
      setSiteId(sites[0].id);
    }
  }, [sites, siteId]);

  useEffect(() => {
    if (!siteId || deviceId) return;
    const site = sites.find((s) => s.id === siteId);
    setDeviceId(suggestDeviceId(site?.name, "01"));
  }, [siteId, sites, deviceId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreatedKey(null);
    try {
      const r = await createDevice({
        variables: {
          input: {
            siteId,
            deviceId: deviceId.trim(),
            name: name.trim() || null,
            board: board || null,
            expectedIntervalSeconds: interval
          }
        },
        refetchQueries: [AdminDevicesDocument],
        awaitRefetchQueries: true
      });
      const result = r.data?.createAdminDevice;
      if (result) {
        setCreatedKey({
          deviceUuid: result.device.id,
          deviceId: result.device.deviceId,
          apiKey: result.apiKey
        });
      }
    } catch (err) {
      setError(apolloErrorMessage(err));
    }
  }

  if (createdKey) {
    return (
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Device created — copy the API key now</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This is the only time the plaintext key is shown. The server only stores the SHA-256 hash. You can copy it
            into the firmware installer below; if you lose it, rotate a new one from the device list.
          </p>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Device ID</p>
            <code className="block break-all rounded bg-muted p-2 font-mono text-sm">{createdKey.deviceId}</code>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">API key (shown once)</p>
            <code className="block break-all rounded bg-muted p-2 font-mono text-sm">{createdKey.apiKey}</code>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              onClick={() => router.push(`/admin/devices/${createdKey.deviceUuid}/install`)}
            >
              Continue to firmware install
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/admin/devices">Back to devices</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>New device</CardTitle>
        <p className="text-sm text-muted-foreground">
          <Link className="text-primary underline" href="/admin/devices">
            ← Back to devices
          </Link>
        </p>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="dev-site">Site</label>
            <Select id="dev-site" value={siteId} onChange={(e) => setSiteId(e.target.value)} required>
              <option value="" disabled>{sitesLoading ? "Loading sites…" : "Select a site"}</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="dev-id">
              Device ID
            </label>
            <Input
              id="dev-id"
              required
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder="e.g. greenhouse-node-01"
            />
            <p className="text-xs text-muted-foreground">
              Sent in every <code className="font-mono">/ingest</code> payload. Lowercase letters, digits, and dashes.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="dev-name">Friendly name (optional)</label>
            <Input id="dev-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. North greenhouse fish tank" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="dev-board">Board</label>
              <Select id="dev-board" value={board} onChange={(e) => setBoard(e.target.value)}>
                {enabledBoards.map((b) => (
                  <option key={b.id} value={b.id}>{b.displayName}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="dev-interval">Post interval (seconds)</label>
              <Input
                id="dev-interval"
                type="number"
                min={5}
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value) || 300)}
              />
            </div>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={creating || !siteId || !deviceId.trim()}>
              {creating ? "Creating…" : "Create device"}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/admin/devices">Cancel</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
