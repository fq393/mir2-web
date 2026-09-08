// Port of pinned Crystal PlayerObject.PlayWemadeStepSound.
export function stepSound(cell:any):number {
 if(!cell||["back","middle","front"].some(k=>(cell[k]?.library??0)>99))return 0;
 let index=cell.back?.index??-1,moveSound=1;
            if (index >= 0 && index <= 10000)
            {
                if ((index >= 330 && index <= 349) || (index >= 450 && index <= 454) || (index >= 550 && index <= 554) ||
                    (index >= 750 && index <= 754) || (index >= 950 && index <= 954) || (index >= 1250 && index <= 1254) ||
                    (index >= 1400 && index <= 1424) || (index >= 1455 && index <= 1474) || (index >= 1500 && index <= 1524) ||
                    (index >= 1550 && index <= 1574))
                    moveSound = 9;
                else if ((index >= 250 && index <= 254) || (index >= 1005 && index <= 1009) || (index >= 1050 && index <= 1054) ||
                    (index >= 1060 && index <= 1064) || (index >= 1450 && index <= 1454) || (index >= 1650 && index <= 1654))
                    moveSound = 13;
                else if ((index >= 605 && index <= 609) || (index >= 650 && index <= 654) || (index >= 660 && index <= 664) ||
                    (index >= 2000 && index <= 2049) || (index >= 3025 && index <= 3049) || (index >= 2400 && index <= 2424) ||
                    (index >= 4625 && index <= 4649) || (index >= 4675 && index <= 4678))
                    moveSound = 5;
                else if ((index >= 1825 && index <= 1924) || (index >= 2150 && index <= 2174) || (index >= 3075 && index <= 3099) ||
                    (index >= 3325 && index <= 3349) || (index >= 3375 && index <= 3399))
                    moveSound = 21;
                else if (index == 3230 || index == 3231 || index == 3246 || index == 3277 || (index >= 3780 && index <= 3799))
                    moveSound = 17;
                else if (index >= 3825 && index <= 4434)
                    switch (index % 25)
                    {
                        case 0:
                            moveSound = 17;
                            break;
                        default:
                            moveSound = 1;
                            break;
                    }
                else if ((index >= 2075 && index <= 2099) || (index >= 2125 && index <= 2149))
                    moveSound = 25;
                else if (index >= 1800 && index <= 1824)
                    moveSound = 29;
                else moveSound = 1;

                if ((index >= 825 && index <= 1349) && Math.floor((index - 825) / 25) % 2 == 0) moveSound = 5;
                if ((index >= 1375 && index <= 1799) && Math.floor((index - 1375) / 25) % 2 == 0) moveSound = 21;
                if (index == 1385 || index == 1386 || index == 1391 || index == 1392) moveSound = 17;

                index = cell.middle?.index??-1;
                if (index >= 0 && index <= 115)
                    moveSound = 1;
                else if (index >= 120 && index <= 124)
                    moveSound = 9;

                index = cell.front?.index??-1;
                if ((index >= 221 && index <= 289) || (index >= 583 && index <= 658) || (index >= 1183 && index <= 1206) ||
                    (index >= 7163 && index <= 7295) || (index >= 7404 && index <= 7414))
                    moveSound = 5;
                else if ((index >= 3125 && index <= 3267) || (index >= 3757 && index <= 3948) || (index >= 6030 && index <= 6999))
                    moveSound = 17;
                if (index >= 3316 && index <= 3589)
                    moveSound = 25;
            }
            else
                moveSound = 1;

 return moveSound;
}
