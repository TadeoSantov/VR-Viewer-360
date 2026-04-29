"use client";

import { useState, useEffect, useRef } from "react";

interface SceneOption {
  id: string;
  name: string;
}

interface HotspotFormData {
  label: string;
  description: string;
  targetSceneId: string;
  type: "info" | "navigation";
}

interface Props {
  open: boolean;
  scenes: SceneOption[];
  currentSceneId: string;
  initialData?: Partial<HotspotFormData>;
  isEditing?: boolean;
  onConfirm: (data: HotspotFormData) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export default function HotspotModal({
  open,
  scenes,
  currentSceneId,
  initialData,
  isEditing = false,
  onConfirm,
  onCancel,
  onDelete,
}: Props) {
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [targetSceneId, setTargetSceneId] = useState("");
  const [type, setType] = useState<"info" | "navigation">("info");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setLabel(initialData?.label ?? "");
      setDescription(initialData?.description ?? "");
      setTargetSceneId(initialData?.targetSceneId ?? "");
      setType(initialData?.type ?? "info");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, initialData]);

  // Auto-set type when target scene selected
  useEffect(() => {
    if (targetSceneId) setType("navigation");
    else setType("info");
  }, [targetSceneId]);

  if (!open) return null;

  const otherScenes = scenes.filter((s) => s.id !== currentSceneId);

  const handleSubmit = () => {
    if (!label.trim()) return;
    onConfirm({ label: label.trim(), description: description.trim(), targetSceneId, type });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold mb-5">
          {isEditing ? "Editar Hotspot" : "Nuevo Hotspot"}
        </h3>

        {/* Label */}
        <label className="block text-xs text-gray-400 mb-1.5">Nombre</label>
        <input
          ref={inputRef}
          className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 outline-none focus:border-blue-500/50 mb-4"
          placeholder="Ej: Entrada Principal"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") onCancel();
          }}
        />

        {/* Description */}
        <label className="block text-xs text-gray-400 mb-1.5">Descripcion (opcional)</label>
        <textarea
          className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 outline-none focus:border-blue-500/50 mb-4 resize-none h-20"
          placeholder="Descripcion del punto de interes..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {/* Target Scene */}
        {otherScenes.length > 0 && (
          <>
            <label className="block text-xs text-gray-400 mb-1.5">
              Escena destino (convierte en hotspot de navegacion)
            </label>
            <select
              className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white outline-none focus:border-blue-500/50 mb-4 appearance-none"
              value={targetSceneId}
              onChange={(e) => setTargetSceneId(e.target.value)}
            >
              <option value="" className="bg-gray-900">Sin destino (solo info)</option>
              {otherScenes.map((s) => (
                <option key={s.id} value={s.id} className="bg-gray-900">
                  {s.name}
                </option>
              ))}
            </select>
          </>
        )}

        {/* Type badge */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xs text-gray-500">Tipo:</span>
          <span
            className={`px-2 py-0.5 text-xs rounded-full ${
              type === "navigation"
                ? "bg-green-500/15 text-green-400"
                : "bg-blue-500/15 text-blue-400"
            }`}
          >
            {type === "navigation" ? "Navegacion" : "Informacion"}
          </span>
        </div>

        {/* Actions */}
        <div className="flex justify-between">
          <div>
            {isEditing && onDelete && (
              <button
                className="px-4 py-2.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm"
                onClick={onDelete}
              >
                Eliminar
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              className="px-5 py-2.5 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition-colors text-sm"
              onClick={onCancel}
            >
              Cancelar
            </button>
            <button
              className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-colors text-sm disabled:opacity-40"
              onClick={handleSubmit}
              disabled={!label.trim()}
            >
              {isEditing ? "Guardar" : "Crear"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
