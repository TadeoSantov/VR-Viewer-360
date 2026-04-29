"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, type Project } from "@/lib/api";

export default function Dashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.projects.list();
      setProjects(res.projects);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar proyectos");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await api.projects.create({ name: newName.trim(), description: newDesc.trim() });
      setNewName("");
      setNewDesc("");
      setShowModal(false);
      fetchProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear proyecto");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar el proyecto "${name}"?`)) return;
    try {
      await api.projects.delete(id);
      fetchProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  return (
    <div className="min-h-screen px-6 py-16">
      {/* Header */}
      <div className="max-w-5xl mx-auto flex items-start justify-between mb-16">
        <div className="text-center flex-1">
          <h1 className="text-5xl font-extrabold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            VR Tour Platform
          </h1>
          <p className="mt-3 text-gray-400 text-lg">
            Selecciona un proyecto o crea uno nuevo
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="max-w-5xl mx-auto mb-8 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-4 underline">
            Cerrar
          </button>
        </div>
      )}

      {/* Grid */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Project cards */}
        {projects.map((p) => (
          <div
            key={p.id}
            onClick={() => router.push(`/projects/${p.id}`)}
            className="group relative p-6 rounded-2xl bg-white/5 border border-white/10 cursor-pointer transition-all hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.07]"
          >
            {/* Delete button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(p.id, p.name);
              }}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20"
              title="Eliminar"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>

            {/* Thumbnail placeholder */}
            <div className="w-full h-32 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/30">
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20" />
                <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
              </svg>
            </div>

            <h2 className="font-semibold text-lg truncate">{p.name}</h2>
            {p.description && (
              <p className="text-sm text-gray-400 mt-1 line-clamp-2">{p.description}</p>
            )}

            <div className="flex items-center gap-3 mt-4 text-xs text-gray-500">
              <span className={`px-2 py-0.5 rounded-full ${p.isPublished ? "bg-green-500/15 text-green-400" : "bg-gray-500/15 text-gray-400"}`}>
                {p.isPublished ? "Publicado" : "Borrador"}
              </span>
              <span>{new Date(p.createdAt).toLocaleDateString("es-MX")}</span>
            </div>
          </div>
        ))}

        {/* New project card */}
        <button
          onClick={() => setShowModal(true)}
          className="p-6 rounded-2xl border-2 border-dashed border-blue-500/30 bg-blue-500/5 flex flex-col items-center justify-center gap-3 text-blue-400 cursor-pointer transition-all hover:bg-blue-500/10 hover:border-blue-500/50 min-h-[220px]"
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span className="font-semibold">Nuevo Proyecto</span>
        </button>
      </div>

      {/* Loading */}
      {loading && projects.length === 0 && (
        <div className="text-center text-gray-500 mt-12">Cargando proyectos...</div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold mb-5">Nuevo Proyecto</h3>

            <label className="block text-xs text-gray-400 mb-1.5">Nombre</label>
            <input
              autoFocus
              className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 outline-none focus:border-blue-500/50 mb-4"
              placeholder="Ej: Mi Escuela VR"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setShowModal(false);
              }}
            />

            <label className="block text-xs text-gray-400 mb-1.5">
              Descripcion (opcional)
            </label>
            <input
              className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 outline-none focus:border-blue-500/50 mb-6"
              placeholder="Ej: Tour virtual del campus"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setShowModal(false);
              }}
            />

            <div className="flex justify-end gap-3">
              <button
                className="px-5 py-2.5 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition-colors"
                onClick={() => setShowModal(false)}
              >
                Cancelar
              </button>
              <button
                className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-colors"
                onClick={handleCreate}
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
