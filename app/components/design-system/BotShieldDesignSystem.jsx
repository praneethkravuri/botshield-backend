/* eslint-disable react/prop-types */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useBotShieldAction } from "../../hooks/use-botshield-action";
import { getUiStatus } from "../../lib/ui-status";

const ToastContext = createContext({
  success: () => {},
  error: () => {},
  warning: () => {},
});

export function BotShieldToastProvider({ children }) {
  const shopify = useAppBridge();
  const lastToast = useRef({ message: "", at: 0 });

  const show = useCallback(
    (message, options = {}) => {
      const now = Date.now();
      if (
        lastToast.current.message === message &&
        now - lastToast.current.at < 1200
      ) {
        return;
      }
      lastToast.current = { message, at: now };
      shopify.toast.show(message, options);
    },
    [shopify],
  );

  const value = useMemo(
    () => ({
      success: (message) => show(message),
      error: (message) => show(message, { isError: true, duration: 5000 }),
      warning: (message) => show(message, { duration: 4500 }),
    }),
    [show],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useBotShieldToast() {
  return useContext(ToastContext);
}

export function BotShieldAppFrame({ children }) {
  return (
    <BotShieldToastProvider>
      <s-box background="subdued" minBlockSize="100vh" paddingBlockEnd="large-500">
        {children}
      </s-box>
    </BotShieldToastProvider>
  );
}

export function BotShieldPage({
  title,
  subtitle,
  badge,
  primaryAction,
  secondaryActions,
  banner,
  children,
}) {
  return (
    <s-page heading={title}>
      <s-stack gap="large">
        <s-stack
          direction="inline"
          gap="base"
          justifyContent="space-between"
          alignItems="center"
        >
          <BotShieldPageHeader title={title} subtitle={subtitle} badge={badge} />
          {primaryAction || secondaryActions ? (
            <s-stack direction="inline" gap="small">
              {secondaryActions}
              {primaryAction}
            </s-stack>
          ) : null}
        </s-stack>
        {banner}
        {children}
      </s-stack>
    </s-page>
  );
}

export function BotShieldPageHeader({ subtitle, badge }) {
  if (!subtitle && !badge) return null;
  return (
    <s-stack direction="inline" gap="base" alignItems="center">
      {subtitle ? <s-paragraph color="subdued">{subtitle}</s-paragraph> : null}
      {badge}
    </s-stack>
  );
}

export function BotShieldCard({
  title,
  subtitle,
  badge,
  actions,
  children,
  empty,
  loading,
  error,
}) {
  return (
    <s-section>
      <s-stack gap="base">
        {title || subtitle || badge || actions ? (
          <s-stack
            direction="inline"
            gap="base"
            justifyContent="space-between"
            alignItems="start"
          >
            <s-stack gap="small-200">
              {title ? <s-heading>{title}</s-heading> : null}
              {subtitle ? <s-paragraph color="subdued">{subtitle}</s-paragraph> : null}
            </s-stack>
            <s-stack direction="inline" gap="small">
              {badge}
              {actions}
            </s-stack>
          </s-stack>
        ) : null}
        {error ? <BotShieldBanner tone="critical">{error}</BotShieldBanner> : null}
        {loading ? <BotShieldLoadingState /> : empty || children}
      </s-stack>
    </s-section>
  );
}

export function BotShieldSection({ title, description, action, children }) {
  return (
    <s-stack gap="base">
      <s-stack
        direction="inline"
        gap="base"
        justifyContent="space-between"
        alignItems="center"
      >
        <s-stack gap="small-200">
          <s-heading>{title}</s-heading>
          {description ? <s-paragraph color="subdued">{description}</s-paragraph> : null}
        </s-stack>
        {action}
      </s-stack>
      {children}
    </s-stack>
  );
}

export function BotShieldMetricCard({ label, value, detail, status, loading }) {
  return (
    <s-box
      background="base"
      border="base"
      borderRadius="large"
      padding="base"
      minBlockSize="120px"
    >
      <s-stack gap="small">
        <s-text color="subdued">{label}</s-text>
        {loading ? (
          <s-spinner accessibilityLabel={`Loading ${label}`} />
        ) : (
          <s-heading>{value}</s-heading>
        )}
        <s-stack direction="inline" gap="small" alignItems="center">
          {status ? <BotShieldStatusBadge status={status} /> : null}
          {detail ? <s-text color="subdued">{detail}</s-text> : null}
        </s-stack>
      </s-stack>
    </s-box>
  );
}

export function BotShieldStatusBadge({ status, label, tone }) {
  const model = getUiStatus(status);
  return <s-badge tone={tone || model.tone}>{label || model.label}</s-badge>;
}

export function BotShieldActionButton({
  children,
  onClick,
  variant = "secondary",
  tone = "auto",
  loading = false,
  disabled = false,
  icon,
  accessibilityLabel,
  href,
  target,
  slot,
}) {
  return (
    <s-button
      variant={variant}
      tone={tone}
      loading={loading}
      disabled={disabled || loading}
      icon={icon}
      accessibilityLabel={accessibilityLabel}
      href={href}
      target={target}
      slot={slot}
      onClick={onClick}
    >
      {children}
    </s-button>
  );
}

export function BotShieldAsyncButton({
  children,
  action,
  successMessage,
  errorMessage,
  onSuccess,
  onError,
  disabled,
  ...buttonProps
}) {
  const toast = useBotShieldToast();
  const asyncAction = useBotShieldAction({
    action,
    successMessage,
    errorMessage,
    toast,
    onSuccess,
    onError,
  });

  return (
    <BotShieldActionButton
      {...buttonProps}
      loading={asyncAction.loading}
      disabled={disabled}
      onClick={asyncAction.run}
    >
      {children}
    </BotShieldActionButton>
  );
}

export function BotShieldBanner({ tone = "info", title, children, action }) {
  return (
    <s-banner tone={tone} heading={title}>
      <s-stack gap="base">
        {children ? <s-paragraph>{children}</s-paragraph> : null}
        {action ? <s-stack direction="inline">{action}</s-stack> : null}
      </s-stack>
    </s-banner>
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
      label={label}
      value={value}
      error={error || ""}
      details={details || ""}
      disabled={disabled}
      type={type}
      placeholder={placeholder}
      autocomplete={autocomplete}
      onInput={(event) => onChange?.(event.currentTarget.value)}
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
      label={label}
      value={value}
      details={details || ""}
      disabled={disabled}
      onChange={(event) => onChange?.(event.currentTarget.value)}
    >
      {options.map((option) => (
        <s-option key={option.value} value={option.value}>
          {option.label}
        </s-option>
      ))}
    </s-select>
  );
}

export function BotShieldToggle({
  label,
  details,
  checked,
  onChange,
  disabled,
  error,
}) {
  return (
    <s-switch
      label={label}
      details={details || ""}
      checked={checked}
      disabled={disabled}
      error={error || ""}
      onChange={(event) => onChange?.(event.currentTarget.checked)}
    />
  );
}

export function BotShieldSaveState({
  dirty,
  saving,
  onSave,
  onDiscard,
  error,
}) {
  if (!dirty && !error) return null;
  return (
    <s-box
      background="subdued"
      border="base"
      borderRadius="large"
      padding="base"
    >
      <s-stack
        direction="inline"
        gap="base"
        justifyContent="space-between"
        alignItems="center"
      >
        <s-stack gap="small-200">
          <s-text type="strong">{error ? "Changes not saved" : "Unsaved changes"}</s-text>
          <s-text color="subdued">
            {error || "Save or discard your changes before leaving this screen."}
          </s-text>
        </s-stack>
        <s-button-group>
          <s-button variant="secondary" disabled={saving} onClick={onDiscard}>
            Discard
          </s-button>
          <s-button variant="primary" loading={saving} onClick={onSave}>
            Save
          </s-button>
        </s-button-group>
      </s-stack>
    </s-box>
  );
}

export function BotShieldEmptyState({ title, description, action }) {
  return (
    <s-box
      background="subdued"
      borderRadius="large"
      padding="large"
      minBlockSize="160px"
    >
      <s-stack gap="base" alignItems="center" justifyContent="center">
        <s-icon type="empty" tone="neutral" size="large" />
        <s-heading>{title}</s-heading>
        <s-paragraph color="subdued">{description}</s-paragraph>
        {action}
      </s-stack>
    </s-box>
  );
}

export function BotShieldLoadingState({ label = "Loading BotShield" }) {
  return (
    <s-box padding="large" minBlockSize="120px">
      <s-stack gap="base" alignItems="center" justifyContent="center">
        <s-spinner accessibilityLabel={label} size="large" />
        <s-text color="subdued">{label}</s-text>
      </s-stack>
    </s-box>
  );
}

export function BotShieldInlineHelp({ children }) {
  return (
    <s-box background="subdued" borderRadius="base" padding="base">
      <s-stack direction="inline" gap="small" alignItems="start">
        <s-icon type="info" tone="info" />
        <s-text color="subdued">{children}</s-text>
      </s-stack>
    </s-box>
  );
}

export function BotShieldDangerZone({ title, description, action }) {
  return (
    <s-box
      background="base"
      border="base"
      borderColor="strong"
      borderRadius="large"
      padding="base"
    >
      <s-stack
        direction="inline"
        gap="base"
        justifyContent="space-between"
        alignItems="center"
      >
        <s-stack gap="small-200">
          <s-heading>{title}</s-heading>
          <s-paragraph color="subdued">{description}</s-paragraph>
        </s-stack>
        {action}
      </s-stack>
    </s-box>
  );
}

export function BotShieldConfirmationModal({
  id,
  heading,
  children,
  confirmLabel,
  onConfirm,
  loading,
  tone = "critical",
}) {
  return (
    <s-modal id={id} heading={heading}>
      <s-box padding="base">
        <s-paragraph>{children}</s-paragraph>
      </s-box>
      <s-button
        slot="primary-action"
        variant="primary"
        tone={tone}
        loading={loading}
        onClick={onConfirm}
      >
        {confirmLabel}
      </s-button>
      <s-button slot="secondary-actions" commandFor={id} command="--hide">
        Cancel
      </s-button>
    </s-modal>
  );
}
