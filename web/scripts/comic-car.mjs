// Three-quarter graphic-novel cars shared with the on-chain renderer.
import { vehicleSvg } from './vehicle-art.mjs';
export const COMIC_VIEW = { x: -22, y: 80, w: 290, h: 106 };
export function comicCar({shape=2,body=2,stripe=1,stripeColor=0,speed=true}={}) {
 const accent=(body+stripeColor)%2?'#ffc61a':'#e4262b';
 const lines=speed?"<path d='M-20 112H5M-12 128H8M-20 144H2' stroke='#ffffff' stroke-width='1.5'/>":'';
 return lines+`<g transform='translate(0 53) scale(.9 .82)'>${vehicleSvg(shape,accent,body*8+stripe)}</g>`;
}
