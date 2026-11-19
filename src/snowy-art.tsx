import type {SVGProps} from 'react';
import garden from './assets/snowy/garden.png?no-inline';
import cave from './assets/snowy/cave.png?no-inline';
import mailbox from './assets/snowy/mailbox.png?no-inline';
import terrain from './assets/snowy/terrain.png?no-inline';

type PieceArt = {viewBox:string; path:string};

// Source coordinates are measured from the supplied 1536 × 1024 concept.
export const snowyArt = {
 garden:{
  viewBox:'924 294 258.333 200',
  path:'M955 439Q928 429 931 418L942 409Q924 402 933 384L947 374 957 372 958 362 949 350Q947 339 956 337L975 344Q961 324 976 323 985 319 992 332L1003 326Q997 320 1001 313L1013 311Q1015 301 1025 300 1036 298 1041 308L1051 314 1055 323Q1054 332 1046 338L1042 352 1037 362 1041 379 1052 370 1063 364 1055 358 1056 347 1065 339 1074 340 1079 330Q1090 331 1091 341L1102 344 1106 356 1099 363 1090 366 1088 377 1076 376 1068 387 1061 399 1063 408 1076 400Q1083 393 1095 401L1104 399 1114 407 1118 420 1110 436 1108 449 970 449 971 466 950 468Z'
 },
 cave:{
  viewBox:'278 370 383.333 275',
  path:'M291 584Q299 556 302 522L309 492Q332 449 367 428 394 403 433 391 461 381 494 384 534 386 561 416 593 449 609 486L624 524 627 560 629 581 638 610 621 634 600 639 583 619 555 616 426 616 397 624 379 639 342 636Q300 622 288 606Z'
 },
 feed:{
  viewBox:'895 541 195.833 175',
  path:'M898 652Q892 631 900 605L907 585 917 563 936 551Q955 541 976 541 1001 540 1018 550 1041 566 1048 597L1050 636 1047 659 1020 666 998 667 993 702 954 708 953 664 915 663Z'
 }
} satisfies Record<string,PieceArt>;

const sprites = {garden,cave,feed:mailbox};

export function SnowyProp({name}:{name:keyof typeof snowyArt}) {
 return <img src={sprites[name]} alt="" draggable={false}/>;
}

export function SnowyGround(props:SVGProps<SVGSVGElement>) {
 return <svg className="pet-snowy-ground" viewBox="132 174 1252 725" aria-hidden="true" {...props}>
  <image href={terrain} width="1536" height="1024"/>
  <path className="pet-ground-drag" data-hit fill="transparent"
   d="M322 557L646 565 745 576 819 560 1090 552 1218 578 1239 634 1271 661 1283 710 1231 754 1151 781 1069 802 964 829 741 850 615 835 472 825 391 803 318 776 263 748 234 722 215 695 221 661 250 625 262 596Z"/>
 </svg>;
}
