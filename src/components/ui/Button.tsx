"use client";

import React, { forwardRef } from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "brand"
  | "danger"
  | "warning"
  | "success"
  | "outline"
  | "ghost"
  | "dark";

export type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl" | "icon";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Text content (can also use children) */
  text?: string;
  /** Button style variant or predefined color theme */
  variant?: ButtonVariant;
  /** Custom background color (can be a hex code, tailwind class, or preset name) */
  color?: ButtonVariant | string;
  /** Size of the button */
  size?: ButtonSize;
  /** Left icon element */
  leftIcon?: React.ReactNode;
  /** Right icon element */
  rightIcon?: React.ReactNode;
  /** Alternative icon prop (same as leftIcon) */
  icon?: React.ReactNode;
  /** Displays a loading spinner and sets aria-busy */
  isLoading?: boolean;
  /** Alias for isLoading */
  loading?: boolean;
  /** Full width block button */
  fullWidth?: boolean;
  /** Explicit accessible aria-label (recommended for accessibility) */
  ariaLabel?: string;
  /** Custom border radius (defaults strictly to 2px) */
  borderRadius?: string;
}

const sizeStyles: Record<ButtonSize, string> = {
  xs: "text-[11px] px-2.5 py-1 gap-1.5 min-h-[26px]",
  sm: "text-xs px-3.5 py-1.5 gap-2 min-h-[32px]",
  md: "text-sm px-4 py-2 gap-2 min-h-[40px]",
  lg: "text-base px-6 py-2.5 gap-2.5 min-h-[48px]",
  xl: "text-lg px-8 py-3.5 gap-3 min-h-[54px]",
  icon: "p-2 min-h-[38px] min-w-[38px] justify-center",
};

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[#D70466] text-white hover:bg-[#b5034f] active:bg-[#990242] shadow-md shadow-[#D70466]/20 border border-transparent",
  brand:
    "bg-gradient-to-r from-[#D70466] via-[#E11D48] to-[#7C3AED] text-white hover:opacity-95 active:opacity-90 shadow-lg shadow-[#D70466]/25 border border-transparent",
  secondary:
    "bg-[#7C3AED] text-white hover:bg-[#6D28D9] active:bg-[#5B21B6] shadow-md shadow-[#7C3AED]/20 border border-transparent",
  danger:
    "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-md shadow-red-600/20 border border-transparent",
  warning:
    "bg-amber-500 text-black hover:bg-amber-400 active:bg-amber-600 font-bold shadow-md shadow-amber-500/20 border border-transparent",
  success:
    "bg-emerald-600 text-white hover:bg-emerald-500 active:bg-emerald-700 shadow-md shadow-emerald-600/20 border border-transparent",
  outline:
    "bg-transparent text-white border border-white/20 hover:border-white/40 hover:bg-white/5 active:bg-white/10",
  ghost:
    "bg-transparent text-zinc-300 hover:text-white hover:bg-white/10 active:bg-white/15 border border-transparent",
  dark:
    "bg-[#27272A] text-white hover:bg-[#3F3F46] active:bg-[#18181B] border border-transparent shadow-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      text,
      children,
      variant = "primary",
      color,
      size = "md",
      leftIcon,
      rightIcon,
      icon,
      isLoading = false,
      loading = false,
      disabled = false,
      fullWidth = false,
      ariaLabel,
      borderRadius = "2px",
      className = "",
      style,
      type = "button",
      ...restProps
    },
    ref
  ) => {
    const isBusy = isLoading || loading;
    const isDisabled = disabled || isBusy;

    // Determine variant or custom color
    const effectiveVariant: ButtonVariant = (
      color && variantStyles[color as ButtonVariant]
        ? color
        : variant
    ) as ButtonVariant;

    const baseVariantClass =
      variantStyles[effectiveVariant] || variantStyles.primary;

    // Is custom color a raw CSS color (e.g. hex or rgba)?
    const isRawColor =
      color &&
      !variantStyles[color as ButtonVariant] &&
      (color.startsWith("#") ||
        color.startsWith("rgb") ||
        color.startsWith("hsl"));

    // Effective accessibility label
    const computedAriaLabel =
      ariaLabel ||
      restProps["aria-label"] ||
      text ||
      (typeof children === "string" ? children : undefined);

    const actualLeftIcon = leftIcon || icon;

    return (
      <button
        ref={ref}
        type={type}
        role="button"
        disabled={isDisabled}
        aria-label={computedAriaLabel}
        aria-busy={isBusy}
        aria-disabled={isDisabled}
        style={{
          borderRadius: borderRadius || "2px",
          ...(isRawColor ? { backgroundColor: color } : {}),
          ...style,
        }}
        className={`
          relative inline-flex items-center justify-center font-bold tracking-wide select-none
          transition-all duration-150 ease-in-out
          rounded-[2px]
          ${sizeStyles[size]}
          ${!isRawColor ? baseVariantClass : "text-white border border-transparent"}
          ${fullWidth ? "w-full" : ""}
          ${
            isDisabled
              ? "opacity-50 cursor-not-allowed pointer-events-none"
              : "cursor-pointer hover:scale-[1.01] active:scale-[0.98]"
          }
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D70466] focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B]
          ${className}
        `}
        {...restProps}
      >
        {/* Loading Spinner */}
        {isBusy && (
          <span className="inline-flex items-center justify-center mr-2 animate-spin">
            <svg
              className="w-4 h-4 text-current"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </span>
        )}

        {/* Left Icon */}
        {!isBusy && actualLeftIcon && (
          <span className="inline-flex shrink-0 items-center justify-center" aria-hidden="true">
            {actualLeftIcon}
          </span>
        )}

        {/* Content (Text or Children) */}
        {text ? <span>{text}</span> : children}

        {/* Right Icon */}
        {!isBusy && rightIcon && (
          <span className="inline-flex shrink-0 items-center justify-center" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
