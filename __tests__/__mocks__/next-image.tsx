/** Minimal stub for next/image used in vitest. */
import React from "react";

const NextImage = (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  return <img {...props} />;
};

export default NextImage;
