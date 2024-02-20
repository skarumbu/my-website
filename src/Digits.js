import { useState } from 'react';

import './styling/circle.css'
import './App.css';
import './Row.css'

function Digits() {
    const [numbers, setNumbers] = useState([
        {id: 0, value: 11, shown: true, selected: false}, 
        {id: 1, value: 1, shown: true, selected: false}, 
        {id: 2, value: 99, shown: true, selected: false}, 
        {id: 3, value: 73, shown: true, selected: false}, 
        {id: 4, value: 42, shown: true, selected: false}, 
        {id: 5, value: 93, shown: true, selected: false}, 
    ]);

    const [signs, setSigns] = useState(
        [
            {id: "+", selected: false},
            {id: "-", selected: false},
            {id: "*", selected: false},
            {id: "/", selected: false}
        ]
    )

    const [win, setWin] = useState(false);

    const target = 649;

    function selectNumber(numbers, id) {
        var selectedNumbers = numbers.find(number => number.selected)
        if (selectedNumbers != undefined && selectedNumbers.value + numbers[id].value === target) {
            setWin(true);
        } else if (selectedNumbers != undefined && selectedNumbers.id != id) {
            if (!signs.some(sign => sign.selected) || id == 3 ? numbers[id] % selectedNumbers.value != 0 : false) {
                return;
            }
            setSigns(signs.map((sign) => {
                return {...sign, selected:false};
            }))
            setNumbers(numbers.map((number) => {
                if (number.selected) {
                    return {...number, selected: !number.selected, shown: false};
                } else if (number.id === id) {
                    if (signs[0].selected) {
                        return {...number, value: selectedNumbers.value + number.value};
                    } else if (signs[1].selected) {
                        return {...number, value: selectedNumbers.value -  number.value};
                    } else if (signs[2].selected) {
                        return {...number, value: selectedNumbers.value * number.value};
                    } else if (signs[3].selected) {
                        return {...number, value: selectedNumbers.value / number.value};
                    }
                }
                return number;
            }))
        }
        else {
            setNumbers(numbers.map((number) => {
                return number.id == id ? {...number, selected: !number.selected} : number;
            }))
        }
    }

    function selectSign(signs, id) {
        setSigns(signs.map((sign) => {
            return sign.id == id ? {...sign, selected: !sign.selected} : {...sign, selected: false};
        }))
    }

    return (
        <div>
            <header className="Main-text" style={{fontFamily: "Seaweed Script"}}>
                {win && 
                    <div className='Row'>
                        You Win!
                    </div>
                }
                {!win &&
                    <><div className='Row'>
                        Target: {target}
                    </div><div className='Row'>
                            <span className='Circle' onClick={() => selectSign(signs, "+")} style={signs[0].selected ? { backgroundColor: 'black' } : {}}>&#43;</span>
                            <span className='Circle' onClick={() => selectSign(signs, "-")} style={signs[1].selected ? { backgroundColor: 'black' } : {}}>&#8722;</span>
                            <span className='Circle' onClick={() => selectSign(signs, "*")} style={signs[2].selected ? { backgroundColor: 'black' } : {}}>&#215;</span>
                            <span className='Circle' onClick={() => selectSign(signs, "/")} style={signs[3].selected ? { backgroundColor: 'black' } : {}}>&#247;</span>
                        </div><div className='Row'>
                            {numbers[0].shown && <a className="Circle" onClick={() => selectNumber(numbers, 0)} style={numbers[0].selected ? { backgroundColor: 'black' } : {}}>{numbers[0].value}</a>}
                            {numbers[1].shown && <a className="Circle" onClick={() => selectNumber(numbers, 1)} style={numbers[1].selected ? { backgroundColor: 'black' } : {}}>{numbers[1].value}</a>}
                            {numbers[2].shown && <a className="Circle" onClick={() => selectNumber(numbers, 2)} style={numbers[2].selected ? { backgroundColor: 'black' } : {}}>{numbers[2].value}</a>}
                        </div><div className='Row'>
                            {numbers[3].shown && <a className="Circle" onClick={() => selectNumber(numbers, 3)} style={numbers[3].selected ? { backgroundColor: 'black' } : {}}>{numbers[3].value}</a>}
                            {numbers[4].shown && <a className="Circle" onClick={() => selectNumber(numbers, 4)} style={numbers[4].selected ? { backgroundColor: 'black' } : {}}>{numbers[4].value}</a>}
                            {numbers[5].shown && <a className="Circle" onClick={() => selectNumber(numbers, 5)} style={numbers[5].selected ? { backgroundColor: 'black' } : {}}>{numbers[5].value}</a>}
                        </div></>
            }
            </header>
        </div>
    );
}


export default Digits;