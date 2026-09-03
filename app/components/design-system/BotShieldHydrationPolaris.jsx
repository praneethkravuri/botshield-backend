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

const POLARIS_GAP_MAP = {
  "small-200": "4px",
  "small-100": "6px",
  small: "8px",
  base: "12px",
  large: "16px",
};

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

function layoutPropsToStyle({
  gap,
  direction,
  alignItems,
  justifyContent,
  gridTemplateColumns,
  padding,
  paddingBlock,
  paddingBlockStart,
  paddingBlockEnd,
  paddingInline,
  background,
  border,
  borderColor,
  borderRadius,
  minBlockSize,
  minInlineSize,
  inlineSize,
  blockSize,
  borderBlockEnd,
}) {
  const style = {};

  if (gap) {
    style.gap = POLARIS_GAP_MAP[gap] || gap;
  }
  if (gridTemplateColumns) {
    style.display = "grid";
    style.gridTemplateColumns = gridTemplateColumns;
  } else if (direction === "inline") {
    style.display = "flex";
    style.flexDirection = "row";
  } else if (direction) {
    style.display = "flex";
    style.flexDirection = "column";
  } else if (gap || alignItems || justifyContent) {
    style.display = "flex";
    style.flexDirection = "column";
  }

  if (alignItems) style.alignItems = alignItems;
  if (justifyContent) style.justifyContent = justifyContent;
  if (padding) style.padding = padding;
  if (paddingBlock) style.paddingBlock = paddingBlock;
  if (paddingBlockStart) style.paddingBlockStart = paddingBlockStart;
  if (paddingBlockEnd) style.paddingBlockEnd = paddingBlockEnd;
  if (paddingInline) style.paddingInline = paddingInline;
  if (background) style.background = background;
  if (border) style.border = border;
  if (borderColor) style.borderColor = borderColor;
  if (borderRadius) style.borderRadius = borderRadius;
  if (minBlockSize) style.minBlockSize = minBlockSize;
  if (minInlineSize) style.minInlineSize = minInlineSize;
  if (inlineSize) style.inlineSize = inlineSize;
  if (blockSize) style.blockSize = blockSize;
  if (borderBlockEnd) style.borderBlockEnd = borderBlockEnd;

  return style;
}

/**
 * Leaf hosts render native HTML so polaris.js cannot mutate React-owned s-*
 * internals before hydrateRoot completes.
 */
function createLeafHost(kind, tag, { mapProps } = {}) {
  return function BotShieldLeafHost({ children, className, ...props }) {
    const mapped = mapProps ? mapProps(props) : {};
    const htmlProps = stripPolarisProps(props);
    for (const key of Object.keys(mapped)) {
      delete htmlProps[key];
    }

    return createElement(
      tag,
      {
        ...htmlProps,
        ...mapped,
        className: joinClassNames(`botshield-polaris-${kind}`, className),
        "data-botshield-polaris-leaf": kind,
      },
      children,
    );
  };
}

/**
 * Layout hosts render as plain HTML so React keeps ownership of mixed child trees.
 * Polaris layout props are mapped to CSS so approved spacing survives without s-stack.
 */
function createLayoutHost(layoutKind) {
  return function BotShieldLayoutHost({ children, className, style, ...props }) {
    return createElement(
      "div",
      {
        ...stripPolarisProps(props),
        className: joinClassNames(`botshield-layout-${layoutKind}`, className),
        "data-botshield-layout": layoutKind,
        style: { ...layoutPropsToStyle(props), ...style },
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

export const BotShieldText = createLeafHost("text", "span");
export const BotShieldParagraph = createLeafHost("paragraph", "p");
export const BotShieldHeading = createLeafHost("heading", "h3");
export const BotShieldIcon = createLeafHost("icon", "span");
export const BotShieldSpinner = createLeafHost("spinner", "span", {
  mapProps: ({ accessibilityLabel }) => ({
    role: "status",
    "aria-label": accessibilityLabel || "Loading",
  }),
});
export const BotShieldBadge = createLeafHost("badge", "span");
export const BotShieldModalShell = createLayoutHost("modal");
export const BotShieldPolarisButton = createLeafHost("button", "button", {
  mapProps: ({ disabled, loading, variant, tone, type }) => ({
    type: type || "button",
    disabled: Boolean(disabled || loading),
    "data-variant": variant || "secondary",
    "data-tone": tone || "auto",
    "data-loading": loading ? "true" : undefined,
  }),
});
export const BotShieldDivider = createLeafHost("divider", "hr", {
  mapProps: () => ({ "aria-hidden": "true" }),
});

export function BotShieldSearchField({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}) {
  return (
    <label className="botshield-polaris-search-field">
      <span className="botshield-polaris-field-label">{label}</span>
      <input
        disabled={disabled}
        onInput={(event) => onChange?.(event.currentTarget.value)}
        placeholder={placeholder}
        type="search"
        value={value}
      />
    </label>
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
    <label className="botshield-polaris-text-field">
      <span className="botshield-polaris-field-label">{label}</span>
      <input
        autoComplete={autocomplete}
        disabled={disabled}
        onInput={(event) => onChange?.(event.currentTarget.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
      {details ? <span className="botshield-polaris-field-details">{details}</span> : null}
      {error ? <span className="botshield-polaris-field-error">{error}</span> : null}
    </label>
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
    <label className="botshield-polaris-select">
      <span className="botshield-polaris-field-label">{label}</span>
      <select
        disabled={disabled}
        onChange={(event) => onChange?.(event.currentTarget.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {details ? <span className="botshield-polaris-field-details">{details}</span> : null}
    </label>
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
    <label className="botshield-polaris-switch">
      <input
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.currentTarget.checked)}
        type="checkbox"
      />
      <span className="botshield-polaris-field-label">{label}</span>
      {details ? <span className="botshield-polaris-field-details">{details}</span> : null}
      {error ? <span className="botshield-polaris-field-error">{error}</span> : null}
    </label>
  );
}

export function BotShieldPolarisPage({ heading, children, ...props }) {
  return createElement("s-page", { ...props, heading }, children);
}
