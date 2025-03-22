import React from 'react';
import refresh from '../../images/refresh.png';

import { motion } from 'framer-motion';

interface RetryCircleProps {
    onClick: () => void;
}

const RetryCircle: React.FC<RetryCircleProps> = ({onClick}) => {
    return (
        <a className='Circle' onClick={onClick} style={{ backgroundColor: '#bdcc77', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <motion.div whileHover={{ rotate: 360, transition: { duration: .25 } }} style={{ maxWidth: '100%', maxHeight: '100%' }}>
                <img src={refresh} alt="Refresh" style={{ maxWidth: '100%', maxHeight: '100%' }} />
            </motion.div>
        </a>
    );
};

export default RetryCircle;