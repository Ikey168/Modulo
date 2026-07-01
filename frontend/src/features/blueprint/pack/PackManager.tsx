import React, { useEffect, useState, useRef } from 'react';
import { Button, Input, Textarea, Badge, Switch, Tabs, TabsList, TabsTrigger, Separator } from '@/ui';
import {
  listPacks, installPack, uninstallPack, publishPackToIpfs, installPackFromCid,
  anchorPack, setPackPricing,
  type PackEntry,
} from './packService';
import type { PackManifest } from './packManifest';
import { validateManifest } from './packManifest';
import { NodeCatalog } from '../nodeCatalog';

type Tab = 'installed' | 'install';

export default function PackManager() {
  const [tab, setTab] = useState<Tab>('installed');
  const [packs, setPacks] = useState<PackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Install-from-manifest
  const [installText, setInstallText] = useState('');
  const [installError, setInstallError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);

  // Install-from-CID
  const [cidInput, setCidInput] = useState('');
  const [hashInput, setHashInput] = useState('');
  const [cidError, setCidError] = useState<string | null>(null);
  const [cidInstalling, setCidInstalling] = useState(false);

  // Per-row actions
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishResults, setPublishResults] = useState<Record<string, { cid: string; hash: string; url: string }>>({});
  const [uninstallingId, setUninstallingId] = useState<string | null>(null);

  // Manage (anchor + pricing) per-row
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [anchoringId, setAnchoringId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState<{ premium: boolean; price: string; royalty: string }>(
    { premium: false, price: '', royalty: '' });
  const [savingPricing, setSavingPricing] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function load() {
    try {
      const data = await listPacks();
      setPacks(data);
      setError(null);
    } catch {
      setError('Failed to load packs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleInstall() {
    setInstallError(null);
    let manifest: PackManifest;
    try {
      manifest = JSON.parse(installText);
    } catch {
      setInstallError('Invalid JSON');
      return;
    }
    const check = validateManifest(manifest, new NodeCatalog());
    if (!check.ok) {
      setInstallError(check.reason ?? 'Invalid manifest');
      return;
    }
    setInstalling(true);
    try {
      const result = await installPack(manifest);
      if (result.ok) {
        setInstallText('');
        setTab('installed');
        await load();
      } else {
        setInstallError(result.reason ?? 'Install failed');
      }
    } catch {
      setInstallError('Network error');
    } finally {
      setInstalling(false);
    }
  }

  async function handleInstallFromCid() {
    setCidError(null);
    if (!cidInput.trim()) { setCidError('CID is required'); return; }
    setCidInstalling(true);
    try {
      const result = await installPackFromCid(cidInput.trim(), hashInput.trim() || undefined);
      if (result.ok) {
        setCidInput('');
        setHashInput('');
        setTab('installed');
        await load();
      } else {
        setCidError(result.reason ?? 'Install failed');
      }
    } catch {
      setCidError('Network error');
    } finally {
      setCidInstalling(false);
    }
  }

  async function handlePublish(packId: string) {
    setPublishingId(packId);
    try {
      const result = await publishPackToIpfs(packId);
      if (result.ok && result.cid && result.contentHash && result.gatewayUrl) {
        setPublishResults(prev => ({
          ...prev,
          [packId]: { cid: result.cid!, hash: result.contentHash!, url: result.gatewayUrl! },
        }));
        await load();
      } else {
        setError(result.reason ?? 'Publish failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setPublishingId(null);
    }
  }

  async function handleUninstall(packId: string) {
    setUninstallingId(packId);
    try {
      const result = await uninstallPack(packId);
      if (result.ok) {
        await load();
      } else {
        setError(result.reason ?? 'Uninstall failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setUninstallingId(null);
    }
  }

  function toggleManage(pack: PackEntry) {
    if (expandedId === pack.packId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(pack.packId);
    setPriceDraft({
      premium: Boolean(pack.premium),
      price: pack.accessPrice ?? '',
      royalty: pack.royaltyBps != null ? String(pack.royaltyBps) : '',
    });
  }

  async function handleAnchor(packId: string) {
    setAnchoringId(packId);
    try {
      const result = await anchorPack(packId);
      if (!result.ok) {
        setError(result.reason ?? 'Anchor failed');
      }
      await load();
    } catch {
      setError('Network error');
    } finally {
      setAnchoringId(null);
    }
  }

  async function handleSavePricing(packId: string) {
    setSavingPricing(true);
    try {
      const result = await setPackPricing(
        packId,
        priceDraft.premium,
        priceDraft.premium ? priceDraft.price : undefined,
        priceDraft.royalty ? Number(priceDraft.royalty) : 0,
      );
      if (result.ok) {
        setExpandedId(null);
        await load();
      } else {
        setError(result.reason ?? 'Failed to save pricing');
      }
    } catch {
      setError('Network error');
    } finally {
      setSavingPricing(false);
    }
  }

  return (
    <div className="mx-auto max-w-[900px] p-6 text-foreground">
      <h2 className="mb-4 text-[1.4rem] font-semibold text-foreground">Packs</h2>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList variant="underline" className="mb-5">
          <TabsTrigger value="installed">Installed ({packs.length})</TabsTrigger>
          <TabsTrigger value="install">Install</TabsTrigger>
        </TabsList>
      </Tabs>

      {error && (
        <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/15 px-3 py-2 text-sm text-destructive">{error}</div>
      )}

      {tab === 'installed' && (
        loading ? (
          <div className="mb-6 text-[0.9rem] text-muted-foreground">Loading…</div>
        ) : packs.length === 0 ? (
          <div className="mb-6 text-[0.9rem] text-muted-foreground">No packs installed.</div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  {['ID', 'Version', 'Source', 'IPFS', 'Chain', 'Price', '', ''].map((h, i) => (
                    <th
                      key={i}
                      className="px-3 py-2 text-left text-[0.75rem] font-medium uppercase tracking-[0.05em] text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {packs.map(p => {
                  const pub = publishResults[p.packId];
                  const cid = pub?.cid ?? p.ipfsCid;
                  const hash = pub?.hash ?? p.contentHash;
                  const url = pub?.url ?? p.gatewayUrl;
                  const expanded = expandedId === p.packId;
                  return (
                    <React.Fragment key={p.packId}>
                    <tr className="border-b border-border">
                      <td className="px-3 py-2 font-mono text-indigo-400">{p.packId}</td>
                      <td className="px-3 py-2">{p.version}</td>
                      <td className="px-3 py-2">
                        <Badge variant={(p.source ?? 'LOCAL') === 'IPFS' ? 'info' : 'secondary'}>
                          {p.source ?? 'LOCAL'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-[0.8rem]">
                        {cid ? (
                          <div className="flex flex-col gap-0.5">
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-indigo-400 no-underline hover:underline"
                              title={cid}
                            >
                              {cid.slice(0, 14)}…
                            </a>
                            {hash && <span className="font-mono text-[0.75rem] text-muted-foreground" title={hash}>sha256: {hash.slice(0, 8)}…</span>}
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePublish(p.packId)}
                            disabled={publishingId === p.packId}
                          >
                            {publishingId === p.packId ? 'Publishing…' : 'Publish to IPFS'}
                          </Button>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[0.8rem]">
                        {p.anchorTx ? (
                          <Badge variant="success" className="font-mono" title={`tx: ${p.anchorTx}\nauthor: ${p.authorAddress ?? ''}`}>
                            ⛓ {p.anchorTx.slice(0, 10)}…
                          </Badge>
                        ) : (
                          <span className="text-[0.75rem] text-muted-foreground">unanchored</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {p.premium ? (
                          <Badge variant="warning" className="font-mono" title={`${p.accessPrice} MODO base units`}>
                            {p.accessPrice} MODO
                          </Badge>
                        ) : (
                          <span className="text-[0.75rem] text-muted-foreground">Free</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Button variant="secondary" size="sm" onClick={() => toggleManage(p)}>
                          {expanded ? 'Close' : 'Manage'}
                        </Button>
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleUninstall(p.packId)}
                          disabled={uninstallingId === p.packId}
                        >
                          {uninstallingId === p.packId ? 'Removing…' : 'Uninstall'}
                        </Button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="border-b border-border bg-surface-2">
                        <td colSpan={8} className="p-0">
                          <div className="flex flex-wrap gap-8 px-4 py-[18px]">
                            <div className="flex min-w-[260px] flex-1 flex-col gap-2">
                              <h4 className="m-0 mb-1 text-[0.85rem] uppercase tracking-[0.05em] text-subtle-foreground">On-chain provenance</h4>
                              {p.anchorTx ? (
                                <div className="mb-1 flex flex-col gap-0.5 break-all text-[0.78rem] text-subtle-foreground">
                                  <div>tx: <code className="font-mono text-[0.75rem] text-indigo-400">{p.anchorTx}</code></div>
                                  <div>author: <code className="font-mono text-[0.75rem] text-indigo-400">{p.authorAddress ?? '—'}</code></div>
                                  {p.onchainId != null && <div>on-chain id: <code className="font-mono text-[0.75rem] text-indigo-400">{p.onchainId}</code></div>}
                                </div>
                              ) : (
                                <p className="mb-2 text-sm text-muted-foreground">Anchor the pack hash on-chain for verifiable authorship.</p>
                              )}
                              <Button
                                variant="primary"
                                size="sm"
                                className="self-start"
                                onClick={() => handleAnchor(p.packId)}
                                disabled={anchoringId === p.packId || !p.contentHash}
                                title={!p.contentHash ? 'Publish to IPFS first' : ''}
                              >
                                {anchoringId === p.packId ? 'Anchoring…' : p.anchorTx ? 'Re-anchor' : 'Anchor on-chain'}
                              </Button>
                            </div>

                            <div className="flex min-w-[260px] flex-1 flex-col gap-2">
                              <h4 className="m-0 mb-1 text-[0.85rem] uppercase tracking-[0.05em] text-subtle-foreground">Pricing</h4>
                              <label className="flex cursor-pointer items-center gap-2 text-[0.85rem] text-subtle-foreground">
                                <Switch
                                  checked={priceDraft.premium}
                                  onCheckedChange={checked => setPriceDraft(d => ({ ...d, premium: checked }))}
                                  aria-label="Premium (paid pack)"
                                />
                                Premium (paid pack)
                              </label>
                              {priceDraft.premium && (
                                <>
                                  <Input
                                    value={priceDraft.price}
                                    onChange={e => setPriceDraft(d => ({ ...d, price: e.target.value }))}
                                    placeholder="Access price (MODO base units, 18 decimals)"
                                    className="font-mono"
                                  />
                                  <Input
                                    value={priceDraft.royalty}
                                    onChange={e => setPriceDraft(d => ({ ...d, royalty: e.target.value }))}
                                    placeholder="Author royalty (basis points, e.g. 250 = 2.5%)"
                                    className="font-mono"
                                  />
                                </>
                              )}
                              <Button
                                variant="primary"
                                size="sm"
                                className="self-start"
                                onClick={() => handleSavePricing(p.packId)}
                                disabled={savingPricing}
                              >
                                {savingPricing ? 'Saving…' : 'Save pricing'}
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'install' && (
        <div className="pt-2">
          <div className="mb-6 flex flex-col gap-2">
            <h3 className="mb-1 text-[1.1rem] font-semibold text-subtle-foreground">Install from IPFS CID</h3>
            <p className="mb-1 text-sm text-muted-foreground">Paste the CID of a published pack. Provide the integrity hash for verification.</p>
            <Input
              value={cidInput}
              onChange={e => setCidInput(e.target.value)}
              placeholder="QmXxx… or bafy…"
              spellCheck={false}
              className="font-mono"
            />
            <Input
              value={hashInput}
              onChange={e => setHashInput(e.target.value)}
              placeholder="SHA-256 hash (optional)"
              spellCheck={false}
              className="font-mono"
            />
            {cidError && <div className="rounded-md border border-destructive/40 bg-destructive/15 px-3 py-2 text-sm text-destructive">{cidError}</div>}
            <Button
              variant="primary"
              className="self-start"
              onClick={handleInstallFromCid}
              disabled={cidInstalling || !cidInput.trim()}
            >
              {cidInstalling ? 'Installing…' : 'Install from CID'}
            </Button>
          </div>

          <Separator className="my-6" />

          <div className="flex flex-col gap-2">
            <h3 className="mb-1 text-[1.1rem] font-semibold text-subtle-foreground">Install from Manifest JSON</h3>
            <p className="mb-1 text-sm text-muted-foreground">Paste a pack manifest JSON directly:</p>
            <Textarea
              ref={textareaRef}
              value={installText}
              onChange={e => setInstallText(e.target.value)}
              rows={10}
              placeholder='{"id": "my-pack", "version": "1.0.0", "name": "My Pack", ...}'
              spellCheck={false}
              className="font-mono text-[0.8rem]"
            />
            {installError && <div className="rounded-md border border-destructive/40 bg-destructive/15 px-3 py-2 text-sm text-destructive">{installError}</div>}
            <Button
              variant="primary"
              className="self-start"
              onClick={handleInstall}
              disabled={installing || !installText.trim()}
            >
              {installing ? 'Installing…' : 'Install from JSON'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
