/* eslint-disable react/prop-types */
import { createElement } from "react";
import { useBotShieldClientMount } from "../../hooks/use-botshield-client-mount";

const POLARIS_ONLY_PROPS = new Set([
  "gap",
  "direction",
  "alignItems",
  "justifyContent",
  "gridTemplateColumns",
  "background",
  "border",
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
]);

function stripPolarisProps(props) {
  const next = { ...props };
  POLARIS_ONLY_PROPS.forEach((key) => {
    delete next[key];
  });
  return next;
}

function joinClassNames(...values) {
  return values.filter(Boolean).join(" ") || undefined;
}

function createHydrationPolarisComponent(tag, fallback) {
  return function BotShieldHydrationPolarisComponent({
    children,
    className,
    ...props
  }) {
    const mounted = useBotShieldClientMount();

    if (!mounted) {
      const htmlProps = stripPolarisProps(props);
      if (fallback.type) htmlProps.type = fallback.type;
      if (fallback.role) htmlProps.role = fallback.role;
      if (fallback.hidden) htmlProps.hidden = true;
      if (fallback.ariaHidden) htmlProps["aria-hidden"] = "true";

      return createElement(
        fallback.tag,
        {
          ...htmlProps,
          className: joinClassNames(fallback.className, className),
        },
        fallback.omitChildren ? null : children,
      );
    }

    return createElement(tag, { ...props, className }, children);
  };
}

export const BotShieldStack = createHydrationPolarisComponent("s-stack", {
  tag: "div",
  className: "botshield-polaris-fallback-stack",
});

export const BotShieldText = createHydrationPolarisComponent("s-text", {
  tag: "span",
  className: "botshield-polaris-fallback-text",
});

export const BotShieldParagraph = createHydrationPolarisComponent("s-paragraph", {
  tag: "p",
  className: "botshield-polaris-fallback-paragraph",
});

export const BotShieldHeading = createHydrationPolarisComponent("s-heading", {
  tag: "h2",
  className: "botshield-polaris-fallback-heading",
});

export const BotShieldGrid = createHydrationPolarisComponent("s-grid", {
  tag: "div",
  className: "botshield-polaris-fallback-grid",
});

export const BotShieldBox = createHydrationPolarisComponent("s-box", {
  tag: "div",
  className: "botshield-polaris-fallback-box",
});

export const BotShieldIcon = createHydrationPolarisComponent("s-icon", {
  tag: "span",
  className: "botshield-polaris-fallback-icon",
  ariaHidden: true,
  omitChildren: true,
});

export const BotShieldSpinner = createHydrationPolarisComponent("s-spinner", {
  tag: "span",
  className: "botshield-polaris-fallback-spinner",
  role: "status",
  omitChildren: true,
});

export const BotShieldBadge = createHydrationPolarisComponent("s-badge", {
  tag: "span",
  className: "botshield-polaris-fallback-badge",
});

export const BotShieldBannerShell = createHydrationPolarisComponent("s-banner", {
  tag: "div",
  className: "botshield-polaris-fallback-banner",
  role: "status",
});

export const BotShieldModalShell = createHydrationPolarisComponent("s-modal", {
  tag: "div",
  className: "botshield-polaris-fallback-modal",
  hidden: true,
});

export const BotShieldButtonGroup = createHydrationPolarisComponent("s-button-group", {
  tag: "div",
  className: "botshield-polaris-fallback-button-group",
});

export const BotShieldPolarisButton = createHydrationPolarisComponent("s-button", {
  tag: "button",
  className: "botshield-polaris-fallback-button",
  type: "button",
});

export const BotShieldTable = createHydrationPolarisComponent("s-table", {
  tag: "table",
  className: "botshield-polaris-fallback-table",
});

export const BotShieldTableHeaderRow = createHydrationPolarisComponent("s-table-header-row", {
  tag: "thead",
  className: "botshield-polaris-fallback-table-header-row",
});

export const BotShieldTableHeader = createHydrationPolarisComponent("s-table-header", {
  tag: "th",
  className: "botshield-polaris-fallback-table-header",
});

export const BotShieldTableBody = createHydrationPolarisComponent("s-table-body", {
  tag: "tbody",
  className: "botshield-polaris-fallback-table-body",
});

export const BotShieldTableRow = createHydrationPolarisComponent("s-table-row", {
  tag: "tr",
  className: "botshield-polaris-fallback-table-row",
});

export const BotShieldTableCell = createHydrationPolarisComponent("s-table-cell", {
  tag: "td",
  className: "botshield-polaris-fallback-table-cell",
});

export const BotShieldDivider = createHydrationPolarisComponent("s-divider", {
  tag: "hr",
  className: "botshield-polaris-fallback-divider",
  omitChildren: true,
});

export function BotShieldSearchField({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}) {
  const mounted = useBotShieldClientMount();

  if (!mounted) {
    return (
      <label className="botshield-polaris-fallback-field">
        {label ? (
          <span className="botshield-polaris-fallback-field-label">{label}</span>
        ) : null}
        <input
          className="botshield-polaris-fallback-input"
          disabled={disabled}
          onChange={(event) => onChange?.(event.currentTarget.value)}
          placeholder={placeholder}
          type="search"
          value={value}
        />
      </label>
    );
  }

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
  const mounted = useBotShieldClientMount();

  if (!mounted) {
    return (
      <label className="botshield-polaris-fallback-field">
        <span className="botshield-polaris-fallback-field-label">{label}</span>
        <input
          autoComplete={autocomplete}
          className="botshield-polaris-fallback-input"
          disabled={disabled}
          onChange={(event) => onChange?.(event.currentTarget.value)}
          placeholder={placeholder}
          type={type}
          value={value}
        />
        {error ? (
          <span className="botshield-polaris-fallback-field-error" role="alert">
            {error}
          </span>
        ) : null}
        {details ? (
          <span className="botshield-polaris-fallback-field-details">{details}</span>
        ) : null}
      </label>
    );
  }

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
  const mounted = useBotShieldClientMount();

  if (!mounted) {
    return (
      <label className="botshield-polaris-fallback-field">
        <span className="botshield-polaris-fallback-field-label">{label}</span>
        <select
          className="botshield-polaris-fallback-select"
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
        {details ? (
          <span className="botshield-polaris-fallback-field-details">{details}</span>
        ) : null}
      </label>
    );
  }

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
  const mounted = useBotShieldClientMount();

  if (!mounted) {
    return (
      <label className="botshield-polaris-fallback-switch">
        <input
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange?.(event.currentTarget.checked)}
          type="checkbox"
        />
        <span className="botshield-polaris-fallback-field-label">{label}</span>
        {details ? (
          <span className="botshield-polaris-fallback-field-details">{details}</span>
        ) : null}
        {error ? (
          <span className="botshield-polaris-fallback-field-error" role="alert">
            {error}
          </span>
        ) : null}
      </label>
    );
  }

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

export function BotShieldHydrationMount({ fallback = null, children }) {
  const mounted = useBotShieldClientMount();
  if (!mounted) return fallback;
  return children;
}

export function BotShieldPolarisPage({ heading, children, ...props }) {
  const mounted = useBotShieldClientMount();

  if (!mounted) {
    return createElement(
      "section",
      {
        ...stripPolarisProps(props),
        "aria-label": heading || "BotShield",
        className: joinClassNames("botshield-polaris-fallback-page", props.className),
      },
      children,
    );
  }

  return createElement("s-page", { heading, ...props }, children);
}
