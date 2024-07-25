import { useEffect, useState } from 'react';
import axios from 'axios';
import FireworksComponent from './FireworksComponent.tsx';
import PulseLoader from "react-spinners/PulseLoader";

import './styling/circle.css';
import './App.css';
import './Row.css';
import React from 'react';

interface Number {
  id: number;
  value: number;
  shown: boolean;
  selected: boolean;
}

interface Sign {
  id: string;
  selected: boolean;
}

const Digits: React.FC = () => {
  const [numbers, setNumbers] = useState<Number[] | null>(null);
  const [signs, setSigns] = useState<Sign[]>([
    { id: "+", selected: false },
    { id: "-", selected: false },
    { id: "*", selected: false },
    { id: "/", selected: false }
  ]);
  const [win, setWin] = useState(false);
  const [target, setTarget] = useState(234);

  useEffect(() => {
    const fetchData = async () => {
      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: 'https://t1w5b1fiz4.execute-api.us-east-1.amazonaws.com/default/DigitsGetter',
        headers: {
          'X-API-KEY': process.env.REACT_APP_API_GATEWAY_KEY!,
          'Content-Type': 'application/json'
        }
      };
      try {
        const response = await axios.request(config);

        const matrix = JSON.parse(response.data.Item.matrix.S);
        const goal = parseInt(response.data.Item.goal.N);

        setNumbers(matrix.map((value: number, index: number) => ({
          id: index,
          value: value,
          shown: true,
          selected: false
        })));

        setTarget(goal);
      } catch (error) {
        console.log(error);
      }
    };

    fetchData();
  }, []);

  const selectNumber = (id: number) => {
    if (numbers === null) return;

    const selectedNumber = numbers.find(number => number.selected);
    const selectedSign = signs.find(sign => sign.selected);

    if (selectedNumber && selectedSign) {
      if (selectedNumber !== undefined && selectedNumber.id !== id) {
        const updatedValue = applyOperation(selectedSign.id, selectedNumber.value, numbers[id].value);
        if (updatedValue == null) {
          console.log("Couldn't calculate value")
          return;
        }
        console.log(updatedValue);
        console.log(target);
        if (updatedValue === target) {
          setWin(true);
          return;
        }
        if (selectedSign.id === "/" && numbers[id].value % selectedNumber.value !== 0) {
          return;
        }
        setSigns(signs.map((sign) => ({ ...sign, selected: false })));

        setNumbers(numbers.map((number) => {
          if (number.selected) {
            return { ...number, selected: !number.selected, shown: false };
          } else if (number.id === id) {
            return { ...number, value: updatedValue, selected: false };
          }
          return number;
        }));
      }
    } else {
      setNumbers(numbers.map((number) => (
        number.id === id ? { ...number, selected: !number.selected } : number
      )));
    }
  };

  const applyOperation = (sign: string, number1: number, number2: number) => {
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
  };

  const selectSign = (id: string) => {
    setSigns(signs.map((sign) => (
      sign.id === id ? { ...sign, selected: !sign.selected } : { ...sign, selected: false }
    )));
  };

  return (
    <div>
      <header className="Main-text" style={{ fontFamily: "Seaweed Script" }}>
        {numbers === null ? (
          <div className="spinner-container">
            <PulseLoader color="#000" size={25} speedMultiplier={.5} />
          </div>
        ) : win ? (
          <div>
            <FireworksComponent />
            <div className='Row' style={{ position: 'absolute' }}>
              You Win!
            </div>
          </div>
        ) : (
          <>
            <div className='Row'>
              Target: {target}
            </div>
            <div className='Row'>
              <span className='Circle' onClick={() => selectSign("+")} style={signs[0].selected ? { backgroundColor: 'black' } : {}}>&#43;</span>
              <span className='Circle' onClick={() => selectSign("-")} style={signs[1].selected ? { backgroundColor: 'black' } : {}}>&#8722;</span>
              <span className='Circle' onClick={() => selectSign("*")} style={signs[2].selected ? { backgroundColor: 'black' } : {}}>&#215;</span>
              <span className='Circle' onClick={() => selectSign("/")} style={signs[3].selected ? { backgroundColor: 'black' } : {}}>&#247;</span>
            </div>
            <div className='Row'>
              {numbers[0].shown && <a className="Circle" onClick={() => selectNumber(0)} style={numbers[0].selected ? { backgroundColor: 'black' } : {}}>{numbers[0].value}</a>}
              {numbers[1].shown && <a className="Circle" onClick={() => selectNumber(1)} style={numbers[1].selected ? { backgroundColor: 'black' } : {}}>{numbers[1].value}</a>}
              {numbers[2].shown && <a className="Circle" onClick={() => selectNumber(2)} style={numbers[2].selected ? { backgroundColor: 'black' } : {}}>{numbers[2].value}</a>}
            </div>
            <div className='Row'>
              {numbers[3].shown && <a className="Circle" onClick={() => selectNumber(3)} style={numbers[3].selected ? { backgroundColor: 'black' } : {}}>{numbers[3].value}</a>}
              {numbers[4].shown && <a className="Circle" onClick={() => selectNumber(4)} style={numbers[4].selected ? { backgroundColor: 'black' } : {}}>{numbers[4].value}</a>}
              {numbers[5].shown && <a className="Circle" onClick={() => selectNumber(5)} style={numbers[5].selected ? { backgroundColor: 'black' } : {}}>{numbers[5].value}</a>}
            </div>
          </>
        )}
      </header>
    </div>
  );
};

export default Digits;
