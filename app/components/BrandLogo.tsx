type BrandLogoProps = {
  className?: string;
};

export function BrandLogo({ className = "" }: BrandLogoProps) {
  return (
    <span className={`brand-logo ${className}`.trim()} role="img" aria-label="AIVirTeach">
      <img src="/logo-only.png" alt="" />
    </span>
  );
}
