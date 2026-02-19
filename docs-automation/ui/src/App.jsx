import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const EMPTY_STEPS = {
  screenshots: 'pending',
  voiceover: 'pending',
  render: 'pending',
};

function useToasts() {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);
  return { toasts, addToast };
}

function ToastContainer({ toasts }) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          {toast.type === 'success' ? '✓ ' : '✕ '}
          {toast.message}
        </div>
      ))}
    </div>
  );
}

export function App() {
  const [products, setProducts] = useState([]);
  const [flows, setFlows] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [outputs, setOutputs] = useState({});
  const [jobs, setJobs] = useState({});
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;
  const { toasts, addToast } = useToasts();
  const [brandStatus, setBrandStatus] = useState('idle');
  const [logoUploadStatus, setLogoUploadStatus] = useState('idle');

  const [brandForm, setBrandForm] = useState({
    accent: '#6366f1',
    accentAlt: '#8b5cf6',
    background: '#0f0f0f',
    logoPath: null,
  });

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    if (!selectedProductId) return;
    loadProduct(selectedProductId);
  }, [selectedProductId]);

  const refreshJob = useCallback(async (jobId) => {
    const res = await fetch(`/api/jobs/${jobId}`);
    if (!res.ok) return;
    const data = await res.json();
    setJobs((current) => ({ ...current, [jobId]: data }));
    if (data.status === 'done') {
      await refreshOutput(data.flowId);
    }
  }, []);

  useEffect(() => {
    const ids = Object.entries(jobs)
      .filter(([, job]) => job.status === 'running' || job.status === 'pending')
      .map(([id]) => id);

    if (ids.length === 0) return;
    const timer = setInterval(() => {
      const currentIds = Object.entries(jobsRef.current)
        .filter(([, job]) => job.status === 'running' || job.status === 'pending')
        .map(([id]) => id);
      if (currentIds.length > 0) {
        Promise.all(currentIds.map((id) => refreshJob(id)));
      }
    }, 2000);

    return () => clearInterval(timer);
  }, [jobs, refreshJob]);

  const filteredFlows = useMemo(() => {
    if (!selectedProductId) return [];
    return flows.filter((flow) => flow.productId === selectedProductId);
  }, [flows, selectedProductId]);

  async function loadInitial() {
    try {
      const [productsRes, flowsRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/flows'),
      ]);
      const productsData = await productsRes.json();
      const flowsData = await flowsRes.json();
      setProducts(productsData);
      setFlows(flowsData);

      const firstProductId = productsData[0]?.id ?? '';
      setSelectedProductId(firstProductId);
      for (const flow of flowsData) {
        await refreshOutput(flow.id);
      }
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  async function loadProduct(productId) {
    try {
      const res = await fetch(`/api/products/${productId}`);
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error ?? 'Falha ao carregar produto.', 'error');
        setBrandForm((prev) => ({
          ...prev,
          accent: '#6366f1',
          accentAlt: '#8b5cf6',
          background: '#0f0f0f',
          logoPath: null,
        }));
        setLogoUploadStatus('idle');
        return;
      }
      const colors = data.brand?.colors ?? {};
      setBrandForm((prev) => ({
        ...prev,
        accent: colors.accent ?? '#6366f1',
        accentAlt: colors.accentAlt ?? '#8b5cf6',
        background: colors.background ?? '#0f0f0f',
        logoPath: data.brand?.assets?.logo ?? null,
      }));
      setLogoUploadStatus('idle');
    } catch (err) {
      addToast(err.message ?? 'Falha ao carregar produto.', 'error');
      setBrandForm((prev) => ({
        ...prev,
        accent: '#6366f1',
        accentAlt: '#8b5cf6',
        background: '#0f0f0f',
        logoPath: null,
      }));
      setLogoUploadStatus('idle');
    }
  }

  async function handleLogoSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogoUploadStatus('uploading');
    try {
      const form = new FormData();
      form.set('logo', file);
      const res = await fetch(`/api/products/${selectedProductId}/logo`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Falha ao enviar logo.');
      setBrandForm((prev) => ({ ...prev, logoPath: data.logoPath }));
      setLogoUploadStatus('done');
    } catch (err) {
      addToast(err.message, 'error');
      setLogoUploadStatus('error');
    }
  }

  async function saveBrand(event) {
    event.preventDefault();
    setBrandStatus('saving');
    const brandPayload = {
      colors: {
        accent: brandForm.accent,
        accentAlt: brandForm.accentAlt,
        background: brandForm.background,
      },
    };
    if (brandForm.logoPath) {
      brandPayload.assets = { logo: brandForm.logoPath };
    }

    const res = await fetch(`/api/products/${selectedProductId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand: brandPayload }),
    });
    const data = await res.json();
    if (!res.ok) {
      addToast(data.error ?? 'Falha ao salvar marca.', 'error');
      setBrandStatus('idle');
      return;
    }
    await loadInitial();
    addToast('Marca salva com sucesso!');
    setBrandStatus('saved');
    setTimeout(() => setBrandStatus('idle'), 2000);
  }

  async function saveComposition(flowId, composition) {
    const res = await fetch(`/api/flows/${flowId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ composition }),
    });
    const data = await res.json();
    if (!res.ok) {
      addToast(data.error ?? 'Falha ao salvar configuração.', 'error');
      return false;
    }
    setFlows((current) => current.map((flow) => (flow.id === flowId ? data : flow)));
    addToast('Configuração salva!');
    return true;
  }

  async function generate(flowId) {
    const res = await fetch(`/api/flows/${flowId}/generate`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      addToast(data.error ?? 'Falha ao iniciar geração.', 'error');
      return false;
    }

    setJobs((current) => ({
      ...current,
      [data.jobId]: {
        status: 'pending',
        steps: { ...EMPTY_STEPS },
        log: [],
      },
    }));
    addToast('Geração de vídeo iniciada!');
    return true;
  }

  async function refreshOutput(flowId) {
    const res = await fetch(`/api/flows/${flowId}/output`);
    if (!res.ok) return;
    const data = await res.json();
    setOutputs((current) => ({ ...current, [flowId]: data }));
  }

  return (
    <>
    <ToastContainer toasts={toasts} />
    <div className="page">
      <header>
        <h1>Videodoc Manager</h1>
        <p>Gerencie produtos, fluxos e geração de vídeos sem editar código.</p>
      </header>

      <section className="card">
        <label>
          Produto:
          <select
            value={selectedProductId}
            onChange={(event) => setSelectedProductId(event.target.value)}
          >
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="card">
        <h2>Marca</h2>
        <form onSubmit={saveBrand} className="grid">
          <label>
            Accent
            <input
              type="color"
              value={brandForm.accent}
              onChange={(event) => setBrandForm((prev) => ({ ...prev, accent: event.target.value }))}
            />
          </label>
          <label>
            Accent Alt
            <input
              type="color"
              value={brandForm.accentAlt}
              onChange={(event) =>
                setBrandForm((prev) => ({ ...prev, accentAlt: event.target.value }))
              }
            />
          </label>
          <label>
            Background
            <input
              type="color"
              value={brandForm.background}
              onChange={(event) =>
                setBrandForm((prev) => ({ ...prev, background: event.target.value }))
              }
            />
          </label>
          <label>
            Logo (opcional)
            {brandForm.logoPath && logoUploadStatus !== 'uploading' && (
              <span className="muted" style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                {logoUploadStatus === 'done' ? '✓ ' : ''}{brandForm.logoPath.split('/').pop()}
              </span>
            )}
            {logoUploadStatus === 'uploading' && (
              <span className="muted" style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                Enviando...
              </span>
            )}
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.svg"
              disabled={logoUploadStatus === 'uploading'}
              onChange={handleLogoSelect}
            />
          </label>
          <button
            type="submit"
            disabled={brandStatus === 'saving'}
            className={brandStatus === 'saved' ? 'btn-saved' : ''}
          >
            {brandStatus === 'saving' ? 'Salvando...' : brandStatus === 'saved' ? 'Salvo ✓' : 'Salvar marca'}
          </button>
        </form>
      </section>

      <VoiceoverSettings addToast={addToast} />

      <section className="flows">
        {filteredFlows.map((flow) => (
          <FlowCard
            key={flow.id}
            flow={flow}
            output={outputs[flow.id]}
            jobs={jobs}
            onSave={saveComposition}
            onGenerate={generate}
          />
        ))}
      </section>
    </div>
    </>
  );
}

function FlowCard({ flow, output, jobs, onSave, onGenerate }) {
  const [local, setLocal] = useState(() => normalizeComposition(flow.composition));
  const [saveStatus, setSaveStatus] = useState('idle');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setLocal(normalizeComposition(flow.composition));
  }, [flow]);

  const activeJob = useMemo(
    () => Object.values(jobs).find((job) => job.flowId === flow.id && job.status !== 'done'),
    [jobs, flow.id]
  );

  async function handleSave() {
    setSaveStatus('saving');
    const ok = await onSave(flow.id, local);
    if (ok) {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } else {
      setSaveStatus('idle');
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    await onGenerate(flow.id);
    setGenerating(false);
  }

  const generatedAt = output?.generatedAt ? new Date(output.generatedAt).toLocaleString('pt-BR') : '-';

  return (
    <article className="card">
      <h2>{flow.label ?? flow.id}</h2>
      <p className="muted">Flow ID: {flow.id}</p>

      <div className="grid">
        <label>
          FPS
          <input
            type="number"
            min={1}
            value={local.fps}
            onChange={(event) => setLocal((prev) => ({ ...prev, fps: Number(event.target.value) }))}
          />
        </label>
        <label>
          Width
          <input
            type="number"
            min={1}
            value={local.width}
            onChange={(event) => setLocal((prev) => ({ ...prev, width: Number(event.target.value) }))}
          />
        </label>
        <label>
          Height
          <input
            type="number"
            min={1}
            value={local.height}
            onChange={(event) => setLocal((prev) => ({ ...prev, height: Number(event.target.value) }))}
          />
        </label>
        <label>
          Duração (s)
          <input
            type="number"
            min={1}
            value={local.durationInSeconds}
            onChange={(event) =>
              setLocal((prev) => ({ ...prev, durationInSeconds: Number(event.target.value) }))
            }
          />
        </label>
        <label>
          appName
          <input
            type="text"
            value={local.defaultProps.appName}
            onChange={(event) =>
              setLocal((prev) => ({
                ...prev,
                defaultProps: { ...prev.defaultProps, appName: event.target.value },
              }))
            }
          />
        </label>
      </div>

      <div className="actions">
        <button
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          className={saveStatus === 'saved' ? 'btn-saved' : ''}
        >
          {saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'saved' ? 'Salvo ✓' : 'Salvar configuração'}
        </button>
        <button
          type="button"
          disabled={!!activeJob || generating}
          aria-disabled={!!activeJob || generating}
          onClick={handleGenerate}
        >
          {generating ? 'Iniciando...' : 'Gerar vídeo'}
        </button>
      </div>

      <p className="muted">Última geração: {generatedAt}</p>
      {output?.exists ? (
        <a className="buttonLink" href={output.downloadUrl} target="_blank" rel="noreferrer">
          Baixar MP4
        </a>
      ) : (
        <p className="muted">Sem vídeo gerado.</p>
      )}

      {activeJob ? (
        <div className="job">
          <h3>Status: {activeJob.status}</h3>
          <p className="muted">
            Passos: screenshots={activeJob.steps?.screenshots ?? 'pending'} / voiceover=
            {activeJob.steps?.voiceover ?? 'pending'} / render={activeJob.steps?.render ?? 'pending'}
          </p>
          {activeJob.error ? <div className="error">{activeJob.error}</div> : null}
          <pre>{(activeJob.log ?? []).join('\n')}</pre>
        </div>
      ) : null}
    </article>
  );
}

function normalizeComposition(composition) {
  return {
    fps: composition?.fps ?? 30,
    width: composition?.width ?? 1280,
    height: composition?.height ?? 720,
    durationInSeconds: composition?.durationInSeconds ?? 12,
    defaultProps: {
      appName: composition?.defaultProps?.appName ?? '',
    },
  };
}

function VoiceoverSettings({ addToast }) {
  const [settings, setSettings] = useState(null);
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCustom, setIsCustom] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/voiceover/settings').then((r) => {
        if (!r.ok) throw new Error(`Settings: ${r.status}`);
        return r.json();
      }),
      fetch('/api/voiceover/voices').then((r) => {
        if (!r.ok) throw new Error(`Voices: ${r.status}`);
        return r.json();
      }),
    ])
      .then(([s, v]) => {
        if (cancelled) return;
        setSettings(s ?? {});
        setVoices(Array.isArray(v) ? v : []);
        const known = Array.isArray(v) && v.find((x) => x?.name === s?.name);
        setIsCustom(!known);
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setSettings({});
          setVoices([]);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  async function save(e) {
    e.preventDefault();
    setError(null);
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/voiceover/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSettings(data);
      const known = voices.find((x) => x.name === data.name);
      setIsCustom(!known);
      addToast('Narração salva com sucesso!');
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      addToast(err.message, 'error');
      setSaveStatus('idle');
    }
  }

  if (loading) return <p className="muted">Carregando voz...</p>;

  if (error && !settings?.name) {
    return (
      <section className="card">
        <h2>Narração (Voice-over)</h2>
        <div className="error">{error}</div>
        <p className="muted">Verifique se o servidor da API está rodando em localhost:3333.</p>
        <button type="button" onClick={() => { setError(null); setLoading(true); window.location.reload(); }}>
          Recarregar
        </button>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Narração (Voice-over)</h2>
      <form onSubmit={save} className="grid">
        <label>
          Voz
          <select
            value={isCustom ? 'custom' : settings?.name ?? ''}
            onChange={(e) => {
              if (e.target.value === 'custom') {
                setIsCustom(true);
                return;
              }
              const v = voices.find((x) => x.name === e.target.value);
              if (v) {
                setIsCustom(false);
                setSettings((prev) => ({
                  ...prev,
                  name: v.name,
                  languageCode: v.languageCode,
                }));
              }
            }}
          >
            {voices.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name} ({v.gender}, {v.type})
              </option>
            ))}
            <option value="custom">Outra (Personalizada)</option>
          </select>
        </label>

        {isCustom && (
          <label>
            Nome da Voz (Google Cloud TTS)
            <input
              type="text"
              value={settings?.name ?? ''}
              onChange={(e) => setSettings((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="ex: pt-BR-Neural2-C"
            />
            <small className="muted">O código do idioma será inferido (ex: pt-BR).</small>
          </label>
        )}

        <label>
          Velocidade (Speaking Rate): {settings?.speakingRate}x
          <input
            type="range"
            min="0.25"
            max="2.0"
            step="0.05"
            value={settings?.speakingRate ?? 1.0}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, speakingRate: Number(e.target.value) }))
            }
          />
        </label>

        <label>
          Tom (Pitch): {settings?.pitch}
          <input
            type="range"
            min="-20"
            max="20"
            step="0.1"
            value={settings?.pitch ?? 0}
            onChange={(e) => setSettings((prev) => ({ ...prev, pitch: Number(e.target.value) }))}
          />
        </label>

        <label>
          Volume (dB): {settings?.volumeGainDb}
          <input
            type="range"
            min="-10"
            max="10"
            step="0.1"
            value={settings?.volumeGainDb ?? 0}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, volumeGainDb: Number(e.target.value) }))
            }
          />
          <small className="muted">Recomendado: -6 a +6 dB</small>
        </label>

        <button
          type="submit"
          disabled={saveStatus === 'saving'}
          className={saveStatus === 'saved' ? 'btn-saved' : ''}
        >
          {saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'saved' ? 'Salvo ✓' : 'Salvar Narração'}
        </button>
      </form>
    </section>
  );
}

