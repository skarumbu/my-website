import { useEffect, useState } from 'react';
import axios from 'axios';

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

    const [target, setTarget] = useState(234);

    useEffect(() => {
        const fetchData = async () => {
            let config = {
                method: 'get',
                maxBodyLength: Infinity,
                url: 'https://t1w5b1fiz4.execute-api.us-east-1.amazonaws.com/default/DigitsGetter',
                headers: { 
                'X-API-KEY': process.env.REACT_APP_API_GATEWAY_KEY, 
                'Content-Type': 'application/json'
                }
            };
            try {
                const response = await axios.request(config)

                const matrix = JSON.parse(response.data.Item.matrix.S)
                const goal = parseInt(response.data.Item.goal.N)

                setNumbers(matrix.map((value, index) => ({
                    id: index,
                    value: value,
                    shown: true,
                    selected: false
                })));

                setTarget(goal);
            } catch (error) {
                console.log(error);
            }
        }

        fetchData();
    }, [])
      
    function selectNumber(id) {
        var selectedNumber = numbers.find(number => number.selected)
        var selectedSign = signs.find(sign => sign.selected)
        if (selectedNumber && selectedSign) {
            var updatedValue = applyOperation(selectedSign, selectedNumber, numbers[id].value)
            if (updatedValue === target) {
                setWin(true);
            } else if (selectedNumber != undefined && selectedNumber.id != id) {
                if (!signs.some(sign => sign.selected) || (id == 3 && numbers[id].value % selectedNumber.value != 0)) {
                    return;
                }
                setSigns(signs.map((sign) => {
                    return {...sign, selected:false};
                }))
                setNumbers(numbers.map((number) => {
                    if (number.selected) {
                        return {...number, selected: !number.selected, shown: false}
                    } else if (number.id === id) {
                        return {...number, selected: updatedValue}
                    }
                    return number
                }))
            }
        }
        else {
            setNumbers(numbers.map((number) => {
                return number.id == id ? {...number, selected: !number.selected} : number;
            }))
        }

    }

    function applyOperation(sign, number1, number2) {
        switch (sign) {
            case '+':
                return number1 + number2;
            case '-':
                return number1 - number2;
            case '*':
                return number1 * number2;
            case '/':
                return number2 !== 0 ? number1 / number2 : null; // Prevent division by zero
            default:
                return null;
        }
    }

    function selectSign(id) {
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
                            <span className='Circle' onClick={() => selectSign("+")} style={signs[0].selected ? { backgroundColor: 'black' } : {}}>&#43;</span>
                            <span className='Circle' onClick={() => selectSign("-")} style={signs[1].selected ? { backgroundColor: 'black' } : {}}>&#8722;</span>
                            <span className='Circle' onClick={() => selectSign("*")} style={signs[2].selected ? { backgroundColor: 'black' } : {}}>&#215;</span>
                            <span className='Circle' onClick={() => selectSign("/")} style={signs[3].selected ? { backgroundColor: 'black' } : {}}>&#247;</span>
                        </div><div className='Row'>
                            {numbers[0].shown && <a className="Circle" onClick={() => selectNumber(0)} style={numbers[0].selected ? { backgroundColor: 'black' } : {}}>{numbers[0].value}</a>}
                            {numbers[1].shown && <a className="Circle" onClick={() => selectNumber(1)} style={numbers[1].selected ? { backgroundColor: 'black' } : {}}>{numbers[1].value}</a>}
                            {numbers[2].shown && <a className="Circle" onClick={() => selectNumber(2)} style={numbers[2].selected ? { backgroundColor: 'black' } : {}}>{numbers[2].value}</a>}
                        </div><div className='Row'>
                            {numbers[3].shown && <a className="Circle" onClick={() => selectNumber(3)} style={numbers[3].selected ? { backgroundColor: 'black' } : {}}>{numbers[3].value}</a>}
                            {numbers[4].shown && <a className="Circle" onClick={() => selectNumber(4)} style={numbers[4].selected ? { backgroundColor: 'black' } : {}}>{numbers[4].value}</a>}
                            {numbers[5].shown && <a className="Circle" onClick={() => selectNumber(5)} style={numbers[5].selected ? { backgroundColor: 'black' } : {}}>{numbers[5].value}</a>}
                        </div></>
            }
            </header>
        </div>
    );
}


export default Digits;