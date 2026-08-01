type AvatarProps = {
  name?: string;
  size?: "small" | "medium" | "large";
  tone?: "teal" | "amber" | "neutral";
};

export function Avatar({ name = "Alex Chen", size = "medium", tone = "neutral" }: AvatarProps) {
  const initials = name.split(" ").map((part) => part[0]).join("").slice(0, 2);
  return (
    <span className={`avatar avatar-${size} avatar-${tone}`} role="img" aria-label={`${name} avatar`}>
      {initials}
    </span>
  );
}
