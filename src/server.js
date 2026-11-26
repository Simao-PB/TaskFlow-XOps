const {createServer} = require('./app');
const port = Number(process.env.PORT || 3000);
const servidor = createServer();

servidor.on('error', erro => {
  if (erro.code === 'EADDRINUSE') {
    console.error(`A porta ${port} ja esta a ser usada (por exemplo, por outro "npm start" ainda aberto).`);
    console.error('Fecha esse processo ou escolhe outra porta com a variavel PORT.');
  } else {
    console.error('Erro ao arrancar o servidor:', erro.message);
  }
  process.exitCode = 1;
});

servidor.listen(port, () => console.log(`Aplicação disponível em http://localhost:${port}`));
