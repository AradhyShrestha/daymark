import Image from "next/image";

export default function BrandLogo({ markOnly = false, className = "" }) {
  return (
    <span className={`daymark-logo${markOnly ? " daymark-logo-mark-only" : ""}${className ? ` ${className}` : ""}`}>
      <span className="brand-mark"><Image src="/daymark-mark.svg" alt="" width={31} height={31} priority /></span>
      {!markOnly && <span>daymark<span className="brand-period">.</span></span>}
    </span>
  );
}