import { useEffect, useState } from 'react';
import axios from 'axios';
import FireworksComponent from './FireworksComponent.tsx';
import NumberCircle from './components/DigitCircle.tsx';
import SignCircle from './components/SignCircle.tsx';
import TargetDisplay from './components/TargetDisplay.tsx';
import Spinner from './components/Spinner.tsx';

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
        if (updatedValue === target) {
          setWin(true);
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
        return number1 % number2 == 0 ? (number1 / number2) : null; // Prevent division by zero
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
    <div className="App">
      {numbers === null ? (
        <Spinner />
      ) : win ? (
        <div>
          <FireworksComponent />
          <div className='Row' style={{ position: 'absolute' }}>
            You Win!
          </div>
        </div>
      ) : (
        <>
          <TargetDisplay target={target} />
          <div className='Row'>
            {signs.map(sign => (
              <SignCircle key={sign.id} id={sign.id} selected={sign.selected} onClick={selectSign} />
            ))}
          </div>
          <div style={{ color: '#add8d2' }}>
            <div className='Row'>
              {numbers.slice(0, 3).map(number => (
                <NumberCircle key={number.id} {...number} onClick={selectNumber} />
              ))}
            </div>
            <div className='Row' style={{ paddingTop: 0 }}>
              {numbers.slice(3).map(number => (
                <NumberCircle key={number.id} {...number} onClick={selectNumber} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Digits;
