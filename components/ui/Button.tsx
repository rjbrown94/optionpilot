import { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
}

export default function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  const styles = {
    primary: "bg-emerald-500 hover:bg-emerald-600 text-black font-semibold",
    secondary:
      "bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white",
    danger: "bg-red-500 hover:bg-red-600 text-white font-semibold",
  };

  return (
    <button
      {...props}
      className={`
        rounded-xl px-5 py-3 text-sm transition-all duration-200
        active:scale-95 disabled:cursor-not-allowed disabled:opacity-50
        ${styles[variant]}
        ${className}
      `}
    >
      {children}
    </button>
  );
}
