"use client";

export function ConfirmSubmit({
  label,
  level = "quiet",
  confirmText,
}: {
  label: string;
  level?: "default" | "quiet";
  confirmText: string;
}) {
  return (
    <button
      className={`abtn${level === "quiet" ? " abtn--quiet" : ""}`}
      type="submit"
      onClick={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {label}
    </button>
  );
}
