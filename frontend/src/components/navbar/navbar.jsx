import styles from './navbar.module.css';
import { LuShoppingCart, LuMenu } from "react-icons/lu";
import { LiaUserCircle } from "react-icons/lia";
import { Drawer } from '@mui/material';
import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Navbar() {
    const [openMenu, setOpenMenu] = useState(false);

    const handleOpenMenu = () => {
        setOpenMenu(!openMenu);
    };

  return (
    <nav className={styles.navBarContainer}>
      <div className={styles.navBarItems}>
        <Link to="/"><img src="/imgs/logoDocs.png" alt="Logo" className={styles.logo} /></Link>
        <div className={styles.navBarLinksContainer}>
          <Link to="/" className={styles.navBarLink}>HOME</Link>
          <Link to="/quotation" className={styles.navBarLink}>COTAÇÃO</Link>
          <Link to="/request" className={styles.navBarLink}>SOLICITAÇÃO</Link>
          <Link to="/profile" className={styles.navBarLinkIcon} >
            <LiaUserCircle />
          </Link>
        </div>
      </div>
      <div className={styles.mobileNavBarItems}>
        <Link to="/"><img src="/imgs/logoDocs.png" alt="Logo" className={styles.logo} /></Link>
        <div className={styles.mobileNavBarBtns}>
          <LuMenu  className={styles.navBarLink} onClick={handleOpenMenu} />
        </div>
      </div>
        <Drawer
        anchor='right'
        open={openMenu}
        onClose={handleOpenMenu}
        >   
            <div className={styles.drawer}>
                <Link to="/" className={styles.navBarLink}>HOME</Link>
                <Link to="/quotation" className={styles.navBarLink}>COTAÇÃO</Link>
                <Link to="/request" className={styles.navBarLink}>SOLICITAÇÃO</Link>
                <Link to="/profile" className={styles.navBarLink}>PERFIL</Link>
            </div>
        </Drawer>
    </nav>
  )
}