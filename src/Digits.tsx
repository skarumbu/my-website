import { useEffect, useState } from 'react';
import axios from 'axios';
import FireworksComponent from './FireworksComponent.tsx';
import NumberCircle from './components/DigitCircle.tsx';
import SignCircle from './components/SignCircle.tsx';
import TargetDisplay from './components/TargetDisplay.tsx';
import Spinner from './components/Spinner.tsx';

import './styling/main.css';
import './Row.css';
import React from 'react';
import RetryCircle from './components/RetryCircle.tsx';

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
  const [numbersList, setNumbersList] = useState<Number[][] | null>(null);
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [originalNumbersList, setOriginalNumbersList] = useState<Number[][] | null>(null);
  const [signs, setSigns] = useState<Sign[]>([
    { id: "+", selected: false },
    { id: "-", selected: false },
    { id: "×", selected: false },
    { id: "÷", selected: false }
  ]);
  const [win, setWin] = useState(false);
  const [targetList, setTargetList] = useState<number[] | null>(null);
  const [solution, setSolution] = useState<string[][]>([]);
  const [pendingMove, setPendingMove] = useState<{ step: 'number1' | 'sign' | 'number2'; number1?: number; sign?: string; number2?: number } | null>(null);

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

        const goalList = JSON.parse(response.data.Item.goalList.S);
        const solutions = JSON.parse(response.data.Item.solutionList.S) as string[][];
        const matrixList = JSON.parse(response.data.Item.matrixList.S);
        const puzzles: number[][] = [];

        for (let i = 0; i < matrixList.length; i += 2) {
          puzzles.push([...matrixList[i], ...(matrixList[i + 1])]);
        }

        const formattedPuzzles = puzzles.map((matrix, matrixIndex) =>
          matrix.map((value: number, index: number) => ({
            id: matrixIndex * 100 + index,
            value: value,
            shown: true,
            selected: false
          }))
        );

        setNumbersList(formattedPuzzles);
        setOriginalNumbersList(formattedPuzzles);
        setTargetList(goalList);
        setSolution(solutions);
      } catch (error) {
        console.log(error);
      }
    };

    fetchData();
  }, []);


  const helpMe = () => {
    if (!numbersList || !solution || currentPuzzleIndex >= solution.length) {
      console.log("No solution found or out of solutions.");
      return;
    }

    const currentSolution = solution[currentPuzzleIndex];

    for (let move of currentSolution) {
      const operations = move.split(/(?=[-+*/])/);
      let currNumber = parseInt(operations[0]);

      for (let i = 1; i < operations.length; i++) {
        const signType = operations[i].substring(0, 1) === "*" ? "×" : operations[i].substring(0, 1);
        const num2 = parseInt(operations[i].slice(1));

        const number1 = numbersList[currentPuzzleIndex].find(num => num.value === currNumber);
        const number2 = numbersList[currentPuzzleIndex].find(num => num.value === num2);
        const signObj = signs.find(sign => sign.id === signType);

        if (number1 && number2 && signObj) {
          setPendingMove({ step: 'number1', number1: number1.id, sign: signObj.id, number2: number2.id });
          return;
        } else {
          var result = applyOperation(signType, currNumber, num2)
          if (result == null) {
            console.log("Bad Operation")
          } else {
            currNumber = result
          }
        }
      }
    }

    retry();
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const addRippleEffect = async (id: number | string) => {
  return new Promise<void>((resolve) => {
    const element = document.getElementById(`number-${id}`) || document.getElementById(`sign-${id}`);
    if (element) {
      element.classList.add("ripple-effect");
      setTimeout(() => {
        element.classList.remove("ripple-effect");
        resolve();
      }, 600);
    } else {
      resolve();
    }
  });
};

useEffect(() => {
  if (pendingMove && pendingMove.step === 'number1') {
    const performMove = async () => {
      await addRippleEffect(pendingMove.number1!);
      selectNumber(pendingMove.number1!);
      await sleep(600);
      setPendingMove(prev => ({ ...prev, step: 'sign' }));
    };

    performMove();
  }
}, [pendingMove]);

useEffect(() => {
  if (pendingMove && pendingMove.step === 'sign') {
    const performMove = async () => {
      await addRippleEffect(pendingMove.sign!);
      selectSign(pendingMove.sign!);
      await sleep(600);
      setPendingMove(prev => ({ ...prev, step: 'number2' }));
    };

    performMove();
  }
}, [pendingMove]);

useEffect(() => {
  if (pendingMove && pendingMove.step === 'number2') {
    const performMove = async () => {
      await addRippleEffect(pendingMove.number2!);
      selectNumber(pendingMove.number2!);
      await sleep(600);
      setPendingMove(null);
    };

    performMove();
  }
}, [pendingMove]);
  const selectNumber = (id: number) => {
    if (!numbersList) return;

    const updatedNumbers = [...numbersList];
    const numbers = updatedNumbers[currentPuzzleIndex];
    const selectedNumber = numbers.find(number => number.selected);
    const selectedSign = signs.find(sign => sign.selected);
    const currentNumber = numbers.find(number => number.id === id);

    if (selectedNumber && selectedSign && currentNumber) {
      if (selectedNumber.id !== id) {
        const updatedValue = applyOperation(selectedSign.id, selectedNumber.value, currentNumber.value);
        if (updatedValue == null) {
          return;
        }
        if (targetList && updatedValue === targetList[currentPuzzleIndex]) {
          setWin(true);
          return;
        }

        setSigns(signs.map((sign) => ({ ...sign, selected: false })));

        updatedNumbers[currentPuzzleIndex] = numbers.map(number => {
          if (number.selected) {
            return { ...number, selected: false, shown: false };
          } else if (number.id === id) {
            return { ...number, value: updatedValue, selected: false };
          }
          return number;
        });
        setNumbersList(updatedNumbers);
      }
    } else {
      updatedNumbers[currentPuzzleIndex] = numbers.map(number =>
        number.id === id ? { ...number, selected: !number.selected } : { ...number, selected: false } 
      );
      setNumbersList(updatedNumbers);
    }
  };

  const applyOperation = (sign: string, number1: number, number2: number) => {
    switch (sign) {
      case '+':
        return number1 + number2;
      case '-':
        return number1 - number2;
      case '×':
        return number1 * number2;
      case '÷':
        return number1 % number2 === 0 ? number1 / number2 : null;
      default:
        return null;
    }
  };
  
  const handlePreviousPuzzle = () => {
    if (numbersList && currentPuzzleIndex > 0) {
      setCurrentPuzzleIndex(currentPuzzleIndex - 1);
    }
  };

  const handleNextPuzzle = () => {
    if (numbersList && currentPuzzleIndex < numbersList.length - 1) {
      setCurrentPuzzleIndex(currentPuzzleIndex + 1);
    }
  };
  const selectSign = (id: string) => {
    setSigns(signs.map((sign) => (
      sign.id === id ? { ...sign, selected: !sign.selected } : { ...sign, selected: false }
    )));
  };
  
  const retry = () => {
    if (originalNumbersList) {
      setNumbersList(prev => {
        if (!prev) return prev;
        const updatedNumbers = [...prev];
        updatedNumbers[currentPuzzleIndex] = [...originalNumbersList[currentPuzzleIndex]];
        return updatedNumbers;
      });
    }
  };

  return (
    <div className="main">
      {numbersList === null ? (
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
          <div className='Row'>
            <TargetDisplay target={targetList ? targetList[currentPuzzleIndex] : 0} />
          </div>
          <div className='Row'>
            {signs.map(sign => (
              <SignCircle key={sign.id} id={sign.id} selected={sign.selected} onClick={selectSign} />
            ))}
          </div>
          <div style={{ color: '#add8d2' }}>
            <div className='Row'>
              {numbersList[currentPuzzleIndex].slice(0, 3).map(number => (
                <NumberCircle key={number.id} {...number} onClick={() => selectNumber(number.id)} />
              ))}
            </div>
            <div className='Row' style={{ paddingTop: 0 }}>
              {numbersList[currentPuzzleIndex].slice(3).map(number => (
                <NumberCircle key={number.id} {...number} onClick={() => selectNumber(number.id)} />
              ))}
            </div>
          </div>
          <div className='Row'>
            <RetryCircle onClick={retry}/>
          </div>
          <div className='Row'>
            <div className='button' onClick={helpMe}>Help me!</div>
          </div>
          <div className='Row'>
            <div className='button' onClick={handlePreviousPuzzle}>← Previous</div>
            <div className='button' onClick={handleNextPuzzle}>Next →</div>
          </div>
        </>
      )}
    </div>
  );
};

export default Digits;
