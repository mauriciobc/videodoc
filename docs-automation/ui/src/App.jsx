import React, { useEffect, useMemo, useState } from 'react';

const EMPTY_STEPS = {
  screenshots: 'pending',
  voiceover: 'pending',
  render: 'pending',
};

export function App() {
  const [products, setProducts] = useState([]);
  const [flows, setFlows] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [outputs, setOutputs] = useState({});
  const [jobs, setJobs] = useState({});
  const [error, setError] = useState('');

  const [brandForm, setBrandForm] = useState({
    accent: '#6366f1',
    accentAlt: '#8b5cf6',
    background: '#0f0f0f',
    logoFile: null,
  });

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    if (!selectedProductId) return;
    loadProduct(selectedProductId);
  }, [selectedProductId]);

  useEffect(() => {
    const ids = Object.entries(jobs)
      .filter(([, job]) => job.status === 'running' || job.status === 'pending')
      .map(([id]) => id);

    if (ids.length === 0) return;
    const timer = setInterval(async () => {
      for (const id of ids) {
        await refreshJob(id);
      }
    }, 2000);

    return () => clearInterval(timer);
  }, [jobs]);

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
      setError(err.message);
    }
  }

  async function loadProduct(productId) {
    const res = await fetch(`/api/products/${productId}`);
    const data = await res.json();
    const colors = data.brand?.colors ?? {};
    setBrandForm((prev) => ({
      ...prev,
      accent: colors.accent ?? '#6366f1',
      accentAlt: colors.accentAlt ?? '#8b5cf6',
      background: colors.background ?? '#0f0f0f',
      logoFile: null,
    }));
  }

  async function saveBrand(event) {
    event.preventDefault();
    const form = new FormData();
    form.set(
      'brand',
      JSON.stringify({
        colors: {
          accent: brandForm.accent,
          accentAlt: brandForm.accentAlt,
          background: brandForm.background,
        },
      })
    );
    if (brandForm.logoFile) {
      form.set('logo', brandForm.logoFile);
    }

    const res = await fetch(`/api/products/${selectedProductId}`, {
      method: 'PATCH',
      body: form,
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Falha ao salvar marca.');
      return;
    }
    await loadInitial();
  }

  async function saveComposition(flowId, composition) {
    const res = await fetch(`/api/flows/${flowId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ composition }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Falha ao salvar configuração.');
      return;
    }
    setFlows((current) => current.map((flow) => (flow.id === flowId ? data : flow)));
  }

  async function generate(flowId) {
    const res = await fetch(`/api/flows/${flowId}/generate`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Falha ao iniciar geração.');
      return;
    }

    setJobs((current) => ({
      ...current,
      [data.jobId]: {
        status: 'pending',
        steps: { ...EMPTY_STEPS },
        log: [],
      },
    }));
  }

  async function refreshJob(jobId) {
    const res = await fetch(`/api/jobs/${jobId}`);
    if (!res.ok) return;
    const data = await res.json();
    setJobs((current) => ({ ...current, [jobId]: data }));
    if (data.status === 'done') {
      await refreshOutput(data.flowId);
    }
  }

  async function refreshOutput(flowId) {
    const res = await fetch(`/api/flows/${flowId}/output`);
    if (!res.ok) return;
    const data = await res.json();
    setOutputs((current) => ({ ...current, [flowId]: data }));
  }

  return (
    <div className="page">
      <header>
        <h1>Videodoc Manager</h1>
        <p>Gerencie produtos, fluxos e geração de vídeos sem editar código.</p>
      </header>

      {error ? <div className="error">{error}</div> : null}

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
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.svg"
              onChange={(event) =>
                setBrandForm((prev) => ({
                  ...prev,
                  logoFile: event.target.files?.[0] ?? null,
                }))
              }
            />
          </label>
          <button type="submit">Salvar marca</button>
        </form>
      </section>

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
  );
}

function FlowCard({ flow, output, jobs, onSave, onGenerate }) {
  const [local, setLocal] = useState(() => normalizeComposition(flow.composition));
  useEffect(() => {
    setLocal(normalizeComposition(flow.composition));
  }, [flow]);

  const activeJob = useMemo(
    () => Object.values(jobs).find((job) => job.flowId === flow.id && job.status !== 'done'),
    [jobs, flow.id]
  );

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
        <button onClick={() => onSave(flow.id, local)}>Salvar configuração</button>
        <button onClick={() => onGenerate(flow.id)}>Gerar vídeo</button>
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

