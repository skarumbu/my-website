import React, { useEffect, useState } from 'react';
import axios from 'axios';
import FireworksComponent from './FireworksComponent.tsx';
import PulseLoader from "react-spinners/PulseLoader";
import { motion, AnimatePresence } from 'framer-motion';
import './styling/circle.css';
import './App.css';
import './Row.css';

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
  const [numbers, setNumbers] = useState<Number[]>([
    { id: 0, value: 10, shown: true, selected: false },
    { id: 1, value: 20, shown: true, selected: false },
    { id: 2, value: 30, shown: true, selected: false },
    { id: 3, value: 40, shown: true, selected: false },
    { id: 4, value: 50, shown: true, selected: false },
    { id: 5, value: 60, shown: true, selected: false },
  ]);
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
        if (selectedSign.id === "/" && numbers[id].value % selectedNumber.value !== 0) {
          return;
        }
        setSigns(signs.map((sign) => ({ ...sign, selected: false })));

        setNumbers(numbers.map((number) => {
          if (number.selected) {
            return { ...number, selected: false, shown: false, animate: true };
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

  // Split numbers into two arrays for two rows
  const firstRowNumbers = numbers.slice(0, 3);
  const secondRowNumbers = numbers.slice(3, 6);

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
              <AnimatePresence>
                {firstRowNumbers.map((number) => (
                  number.shown && (
                    <motion.a
                      key={number.id}
                      className="Circle"
                      onClick={() => selectNumber(number.id)}
                      style={number.selected ? { backgroundColor: 'black' } : {}}
                      initial={{ scale: 1 }}
                      animate={{ scale: number.selected ? 1.2 : 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.5 }}
                    >
                      {number.value}
                    </motion.a>
                  )
                ))}
              </AnimatePresence>
            </div>
            <div className='Row'>
              <AnimatePresence>
                {secondRowNumbers.map((number) => (
                  number.shown && (
                    <motion.a
                      key={number.id}
                      className="Circle"
                      onClick={() => selectNumber(number.id)}
                      style={number.selected ? { backgroundColor: 'black' } : {}}
                      initial={{ scale: 1 }}
                      animate={{ scale: number.selected ? 1.2 : 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.5 }}
                    >
                      {number.value}
                    </motion.a>
                  )
                ))}
              </AnimatePresence>
            </div>
          </>
        )}
      </header>
    </div>
  );
};

export default Digits;
