import React from 'react';
import refresh from '../../images/refresh.png';
import { motion } from 'framer-motion';
import '../../styling/circle.css';

interface RetryCircleProps {
    onClick: () => void;
}

const RetryCircle: React.FC<RetryCircleProps> = ({ onClick }) => {
    return (
        <button
            className="Circle circle-action"
            onClick={onClick}
            style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
        >
            <motion.div
                whileHover={{ rotate: 360, transition: { duration: 0.25 } }}
                style={{ maxWidth: '55%', maxHeight: '55%' }}
            >
                <img src={refresh} alt="Refresh" style={{ maxWidth: '100%', maxHeight: '100%' }} />
            </motion.div>
        </button>
    );
};

export default RetryCircle;
