import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import FireworksComponent from './components/FireworksComponent.tsx';
import NumberCircle from './components/buttons/DigitCircle.tsx';
import SignCircle from './components/SignCircle.tsx';
import TargetDisplay from './components/TargetDisplay.tsx';
import Spinner from './components/Spinner.tsx';

import './styling/main.css';
import './Row.css';
import React from 'react';
import RetryCircle from './components/buttons/RetryCircle.tsx';
import NavBar from './components/nav-bar.tsx';

interface Digit {
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
  const [numbersList, setNumbersList] = useState<Digit[][] | null>(null);
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [originalNumbersList, setOriginalNumbersList] = useState<Digit[][] | null>(null);
  const [signs, setSigns] = useState<Sign[]>([
    { id: "+", selected: false },
    { id: "-", selected: false },
    { id: "×", selected: false },
    { id: "÷", selected: false }
  ]);
  const [solvedPuzzles, setSolvedPuzzles] = useState<boolean[]>([]);
  const [targetList, setTargetList] = useState<number[] | null>(null);
  const [solution, setSolution] = useState<string[][]>([]);
  const [pendingMove, setPendingMove] = useState<{ step: 'number1' | 'sign' | 'number2'; number1?: number; sign?: string; number2?: number } | null>(null);
  const isAnimating = useRef(false);

  useEffect(() => {
    const fetchData = async () => {
      if (process.env.NODE_ENV === 'development') {
        // Stubbed data for local development (mirrors prod shape: 3 puzzles, 6 numbers each)
        const stubbedPuzzles = [
          [
            { id: 0, value: 14, shown: true, selected: false },
            { id: 1, value: 5,  shown: true, selected: false },
            { id: 2, value: 4,  shown: true, selected: false },
            { id: 3, value: 23, shown: true, selected: false },
            { id: 4, value: 22, shown: true, selected: false },
            { id: 5, value: 2,  shown: true, selected: false },
          ],
          [
            { id: 100, value: 86, shown: true, selected: false },
            { id: 101, value: 9,  shown: true, selected: false },
            { id: 102, value: 50, shown: true, selected: false },
            { id: 103, value: 62, shown: true, selected: false },
            { id: 104, value: 72, shown: true, selected: false },
            { id: 105, value: 46, shown: true, selected: false },
          ],
          [
            { id: 200, value: 46, shown: true, selected: false },
            { id: 201, value: 65, shown: true, selected: false },
            { id: 202, value: 34, shown: true, selected: false },
            { id: 203, value: 9,  shown: true, selected: false },
            { id: 204, value: 13, shown: true, selected: false },
            { id: 205, value: 96, shown: true, selected: false },
          ],
        ];
        const stubbedTargets = [114, 660, 2146];
        const stubbedSolutions = [
          ['14+23+22*2-4', '4*5-14*23-22-2', '23+14+5+4*2+22', '23*22-2-4/5+14', '22*5+4', '22+2-4*5+14'],
          ['50-46+72*9-86+62', '72-46+50*9-86+62'],
          ['9+13*96+34'],
        ];
  
        setSolvedPuzzles(new Array(stubbedPuzzles.length).fill(false));
        setNumbersList(stubbedPuzzles);
        setOriginalNumbersList(stubbedPuzzles);
        setTargetList(stubbedTargets);
        setSolution(stubbedSolutions);
      } else {
        // Fetch real data in production
        let config = {
          method: 'get',
          maxBodyLength: Infinity,
          url: 'https://digits-api-prod-hwbxtkz6lsfoq.azurewebsites.net/api/DigitsGetter',
          headers: {
            'Content-Type': 'application/json'
          }
        };

        try {
          const response = await axios.request(config);
          const goalList = JSON.parse(response.data.Item.goalList.S);
          const solutions = JSON.parse(response.data.Item.solutionList.S) as string[][];
          const matrixList = JSON.parse(response.data.Item.matrixList.S);
          const difficulties: string[] = JSON.parse(response.data.Item.difficultyList.S);
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

          const difficultyOrder: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
          const indexed = formattedPuzzles.map((puzzle, i) => ({
            puzzle,
            target: goalList[i],
            solution: solutions[i],
            difficulty: difficulties[i],
          }));
          indexed.sort((a, b) => (difficultyOrder[a.difficulty] ?? 99) - (difficultyOrder[b.difficulty] ?? 99));

          setSolvedPuzzles(new Array(indexed.length).fill(false));
          setNumbersList(indexed.map(p => p.puzzle));
          setOriginalNumbersList(indexed.map(p => p.puzzle));
          setTargetList(indexed.map(p => p.target));
          setSolution(indexed.map(p => p.solution));
        } catch (error) {
          console.log(error);
        }
      }
    };
  
    fetchData();
  }, []);
  


  const helpMe = () => {
    if (!numbersList || !solution || currentPuzzleIndex >= solution.length) {
      console.log("No solution found or out of solutions.");
      return;
    }

    setNumbersList(prev => {
      if (!prev) return prev;
      const updatedNumbers = [...prev];
      updatedNumbers[currentPuzzleIndex] = updatedNumbers[currentPuzzleIndex].map(number => ({
        ...number,
        selected: false
      }));
      return updatedNumbers;
    });

    setSigns(prevSigns => prevSigns.map(sign => ({ ...sign, selected: false })));

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
    if (!numbersList || isAnimating.current) return;

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

        isAnimating.current = true;
        document.getElementById(`number-${selectedNumber.id}`)?.classList.add('combine-out');
        document.getElementById(`number-${id}`)?.classList.add('combine-in');

        setTimeout(() => {
          document.getElementById(`number-${selectedNumber.id}`)?.classList.remove('combine-out');
          document.getElementById(`number-${id}`)?.classList.remove('combine-in');

          if (targetList && updatedValue === targetList[currentPuzzleIndex]) {
            setSolvedPuzzles(prev => prev.map((solved, i) => (i === currentPuzzleIndex ? true : solved)));
          }

          setSigns(prev => prev.map(sign => ({ ...sign, selected: false })));

          setNumbersList(prev => {
            if (!prev) return prev;
            const updated = [...prev];
            updated[currentPuzzleIndex] = numbers.map(number => {
              if (number.selected) return { ...number, selected: false, shown: false };
              if (number.id === id) return { ...number, value: updatedValue, selected: false };
              return number;
            });
            return updated;
          });

          isAnimating.current = false;
        }, 350);
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
      <header className="Main-text">
        <NavBar />
      </header>   
      {numbersList === null ? (
        <Spinner />
      ) : solvedPuzzles.every(Boolean) ? (
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
          {solvedPuzzles[currentPuzzleIndex] && (
            <div className="overlay">
              DONE!
            </div>
          )}
          <div style={{ color: '#add8d2' }}>
            <div className='Row' style={{ pointerEvents: solvedPuzzles[currentPuzzleIndex] ? 'none' : 'auto' }}>
              {numbersList[currentPuzzleIndex].slice(0, 3).map(number => (
                <NumberCircle key={number.id} {...number} onClick={() => selectNumber(number.id)} />
              ))}
            </div>
            <div className='Row' style={{ paddingTop: 0, pointerEvents: solvedPuzzles[currentPuzzleIndex] ? 'none' : 'auto' }}>
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
