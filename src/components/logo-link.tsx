/** Shared top-left mark. Every header uses this anchor. */
export function LogoLink() {
  return (
    <a
      href="https://charoof.vercel.app"
      aria-label="GradedCalls"
      className="logo-link hit-44 flex h-14 min-h-11 min-w-11 shrink-0 items-center gap-2.5 whitespace-nowrap"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        boxSizing: "border-box",
        height: 56,
        minHeight: 56,
        minWidth: 44,
        backgroundColor: "transparent",
      }}
    >
      <img
        src="/gradedcalls-mark.png"
        alt="GradedCalls"
        width={44}
        height={44}
        className="logo-mark"
        style={{
          width: 44,
          height: 44,
          display: "block",
          flex: "none",
          objectFit: "contain",
          backgroundColor: "transparent",
        }}
      />
      <span className="hidden text-[17px] font-semibold tracking-tight text-ink min-[480px]:inline">
        Graded<span className="text-[#eb6505]">Calls</span>
      </span>
    </a>
  );
}
