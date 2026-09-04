type ActnivoMarkProps = {
  className?: string;
};

export function ActnivoMark({ className = "" }: ActnivoMarkProps) {
  // A tiny transparent brand asset is intentionally served directly at its rendered size.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={`actnivo-mark ${className}`.trim()} src="/actnivo-mark.png" alt="" aria-hidden="true" />;
}
