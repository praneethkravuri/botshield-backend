/* eslint-disable react/prop-types */
import { createElement } from "react";

const POLARIS_ONLY_PROPS = new Set([
  "gap",
  "direction",
  "alignItems",
  "justifyContent",
  "gridTemplateColumns",
  "background",
  "border",
  "borderColor",
  "borderRadius",
  "padding",
  "paddingBlock",
  "paddingBlockStart",
  "paddingBlockEnd",
  "paddingInline",
  "minBlockSize",
  "minInlineSize",
  "inlineSize",
  "blockSize",
  "borderBlockEnd",
  "tone",
  "type",
  "size",
  "color",
  "loading",
  "variant",
  "icon",
  "accessibilityLabel",
  "slot",
  "commandFor",
  "command",
  "heading",
  "details",
  "checked",
  "autocomplete",
  "onInput",
  "label",
  "error",
  "placeholder",
  "disabled",
  "href",
  "target",
  "onChange",
  "onClick",
  "onAfterhide",
  "value",
  "role",
]);

function stripPolarisProps(props) {
  const next = { ...props };
  for (const key of POLARIS_ONLY_PROPS) {
    delete next[key];
  }
  return next;
}

function joinClassNames(...values) {
  return values.filter(Boolean).join(" ") || undefined;
}

function createPolarisComponent(tag) {
  return function BotShieldPolarisComponent({ children, className, ...props }) {
    return createElement(tag, { ...props, className }, children);
  };
}

/**
 * Layout hosts render as plain HTML so React keeps ownership of mixed child trees.
 * polaris.js mutates s-stack/s-box/s-grid internals when it upgrades custom
 * elements, which breaks hydration and later reconciliation.
 */
function createLayoutHost(layoutKind) {
  return function BotShieldLayoutHost({ children, className, ...props }) {
    return createElement(
      "div",
      {
        ...stripPolarisProps(props),
        className: joinClassNames(`botshield-layout-${layoutKind}`, className),
        "data-botshield-layout": layoutKind,
      },
      children,
    );
  };
}

export const BotShieldStack = createLayoutHost("stack");
export const BotShieldBox = createLayoutHost("box");
export const BotShieldGrid = createLayoutHost("grid");
export const BotShieldButtonGroup = createLayoutHost("button-group");
export const BotShieldTable = createLayoutHost("table");
export const BotShieldTableHeaderRow = createLayoutHost("table-header-row");
export const BotShieldTableHeader = createLayoutHost("table-header");
export const BotShieldTableBody = createLayoutHost("table-body");
export const BotShieldTableRow = createLayoutHost("table-row");
export const BotShieldTableCell = createLayoutHost("table-cell");
export const BotShieldBannerShell = createLayoutHost("banner");

export const BotShieldText = createPolarisComponent("s-text");
export const BotShieldParagraph = createPolarisComponent("s-paragraph");
export const BotShieldHeading = createPolarisComponent("s-heading");
export const BotShieldIcon = createPolarisComponent("s-icon");
export const BotShieldSpinner = createPolarisComponent("s-spinner");
export const BotShieldBadge = createPolarisComponent("s-badge");
export const BotShieldModalShell = createPolarisComponent("s-modal");
export const BotShieldPolarisButton = createPolarisComponent("s-button");
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

export function BotShieldPolarisPage({ heading, children, ...props }) {
  return createElement(
    "div",
    {
      ...stripPolarisProps(props),
      className: joinClassNames("botshield-native-page", props.className),
      "data-page-heading": heading || undefined,
      role: "region",
      "aria-label": heading || "BotShield",
    },
    children,
  );
}
