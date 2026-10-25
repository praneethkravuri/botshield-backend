/* eslint-disable react/prop-types */
// Native outline icons keep document navigation usable before Polaris loads.
const paths = {
  database: [
    "M20 6c0 2.2-3.6 4-8 4S4 8.2 4 6s3.6-4 8-4 8 1.8 8 4Z",
    "M4 6v12c0 2.2 3.6 4 8 4s8-1.8 8-4V6",
    "M4 12c0 2.2 3.6 4 8 4s8-1.8 8-4",
  ],
  clock: ["M12 8v5l3 2", "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z"],
  back: ["m10 5-7 7 7 7", "M3 12h18"],
  arrow: ["m14 6 6 6-6 6", "M4 12h16"],
  external: [
    "M14 3h7v7",
    "m21 3-11 11",
    "M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5",
  ],
  chevron: ["m6 9 6 6 6-6"],
};

export default function InformationIcon({ name, className = "" }) {
  return (
    <svg
      className={`botshield-information-icon ${className}`}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {(paths[name] || paths.arrow).map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
