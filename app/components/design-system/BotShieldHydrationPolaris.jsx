/* eslint-disable react/prop-types */
import { createElement } from "react";
import { useBotShieldCustomElementClick } from "../../hooks/use-botshield-custom-element-click.js";

function createPolarisComponent(tag) {
  return function BotShieldPolarisComponent({ children, className, ...props }) {
    return createElement(tag, { ...props, className }, children);
  };
}

function BotShieldPolarisButtonComponent({
  children,
  className,
  onClick,
  disabled,
  loading,
  ...props
}) {
  const buttonRef = useBotShieldCustomElementClick(onClick, {
    enabled: !disabled && !loading && typeof onClick === "function",
  });

  return createElement(
    "s-button",
    {
      ...props,
      className,
      disabled,
      loading,
      ref: buttonRef,
    },
    children,
  );
}

export const BotShieldStack = createPolarisComponent("s-stack");
export const BotShieldText = createPolarisComponent("s-text");
export const BotShieldParagraph = createPolarisComponent("s-paragraph");
export const BotShieldHeading = createPolarisComponent("s-heading");
export const BotShieldGrid = createPolarisComponent("s-grid");
export const BotShieldBox = createPolarisComponent("s-box");
export const BotShieldIcon = createPolarisComponent("s-icon");
export const BotShieldSpinner = createPolarisComponent("s-spinner");
export const BotShieldBadge = createPolarisComponent("s-badge");
export const BotShieldBannerShell = createPolarisComponent("s-banner");
export const BotShieldModalShell = createPolarisComponent("s-modal");
export const BotShieldButtonGroup = createPolarisComponent("s-button-group");
export const BotShieldPolarisButton = BotShieldPolarisButtonComponent;
export const BotShieldTable = createPolarisComponent("s-table");
export const BotShieldTableHeaderRow = createPolarisComponent("s-table-header-row");
export const BotShieldTableHeader = createPolarisComponent("s-table-header");
export const BotShieldTableBody = createPolarisComponent("s-table-body");
export const BotShieldTableRow = createPolarisComponent("s-table-row");
export const BotShieldTableCell = createPolarisComponent("s-table-cell");
export const BotShieldDivider = createPolarisComponent("s-divider");

export function BotShieldSearchField({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}) {
  return (
    <s-search-field
      disabled={disabled}
      label={label}
      onInput={(event) => onChange?.(event.currentTarget.value)}
      placeholder={placeholder}
      value={value}
    />
  );
}

export function BotShieldTextField({
  label,
  value,
  onChange,
  error,
  details,
  disabled,
  type = "text",
  placeholder,
  autocomplete = "off",
}) {
  return (
    <s-text-field
      autocomplete={autocomplete}
      details={details || ""}
      disabled={disabled}
      error={error || ""}
      label={label}
      onInput={(event) => onChange?.(event.currentTarget.value)}
      placeholder={placeholder}
      type={type}
      value={value}
    />
  );
}

export function BotShieldSelect({
  label,
  value,
  onChange,
  options,
  details,
  disabled,
}) {
  return (
    <s-select
      details={details || ""}
      disabled={disabled}
      label={label}
      onChange={(event) => onChange?.(event.currentTarget.value)}
      value={value}
    >
      {options.map((option) => (
        <s-option key={option.value} value={option.value}>
          {option.label}
        </s-option>
      ))}
    </s-select>
  );
}

export function BotShieldSwitch({
  label,
  details,
  checked,
  onChange,
  disabled,
  error,
}) {
  return (
    <s-switch
      checked={checked}
      details={details || ""}
      disabled={disabled}
      error={error || ""}
      label={label}
      onChange={(event) => onChange?.(event.currentTarget.checked)}
    />
  );
}

export function BotShieldHydrationMount({ children }) {
  return children;
}

export function BotShieldPolarisPage({ heading, children, ...props }) {
  return createElement("s-page", { heading, ...props }, children);
}
