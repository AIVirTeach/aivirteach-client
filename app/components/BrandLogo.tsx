type BrandLogoProps = {
  className?: string;
};

export function BrandLogo({ className = "" }: BrandLogoProps) {
  return (
    <span className={`brand-logo ${className}`.trim()} role="img" aria-label="AIVirTeach">
      <img src="/aivirteach-logo.png" alt="" />
      <img className="brand-logo-dark-letters" src="/aivirteach-logo.png" alt="" aria-hidden="true" />
    </span>
  );
}
