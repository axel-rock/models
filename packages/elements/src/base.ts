/** An HTMLElement base that keeps package imports safe during server rendering. */
export const ModelsHTMLElement = (
  typeof HTMLElement === "undefined" ? class {} : HTMLElement
) as typeof HTMLElement;
