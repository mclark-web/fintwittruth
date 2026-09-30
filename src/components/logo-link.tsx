/** Shared top-left mark. Every header uses this anchor. */
export function LogoLink() {
  return (
    <a
      href="https://charoof.vercel.app"
      aria-label="GradedCalls"
      className="logo-link hit-44 flex h-14 min-h-11 min-w-11 shrink-0 items-center gap-2.5 whitespace-nowrap"
    >
      <img
        src="/gradedcalls-mark.png"
        alt="GradedCalls"
        width={44}
        height={44}
        className="logo-mark"
      />
      <span className="hidden text-[17px] font-semibold tracking-tight text-ink min-[480px]:inline">
        Graded<span className="text-[#eb6505]">Calls</span>
      </span>
    </a>
  );
}
