// Reusable section header: numbered tag + doodle title + sub-line.
export default function SectionHeader({ num, kicker, title, sub }) {
  return (
    <>
      <span className="section-tag"><b className="text-clay font-medium">{num}</b> {kicker}</span>
      <h2 className="sec-title">
        {title}
        <span className="sec-sub">{sub}</span>
      </h2>
    </>
  );
}
